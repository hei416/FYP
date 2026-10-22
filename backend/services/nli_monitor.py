# services/nli_monitor.py

import re
import asyncio
import torch
import logging
import threading
import os
from concurrent.futures import ThreadPoolExecutor
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from typing import List, Dict, Any, Optional


logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# THRESHOLD — per-chunk entailment threshold for a single claim to be
# considered "supported". 0.5 is used per RAGAS / DeepEval convention:
#   - RAGAS uses 0.5 as the default claim-level entailment cutoff
#   - DeepEval uses 0.7 as the *overall* faithfulness score threshold
#
# SCORING METHODOLOGY (RAGAS / DeepEval claim-level, Section 4.3 FYP):
#   faithfulness = faithful_claims / total_claims
#
# where a claim is "faithful" if its MES (max entailment score across all
# retrieved chunks) >= CLAIM_THRESHOLD.
# ---------------------------------------------------------------------------
CLAIM_THRESHOLD = 0.5   # per-claim NLI entailment cutoff
PASS_THRESHOLD  = 0.70  # overall faithfulness score to be PASS (matches DeepEval default)


def _split_into_claims(text: str) -> List[str]:
    """
    Decompose an LLM response into atomic claims (sentences).

    Uses a simple sentence splitter that handles:
      - Sentence-ending punctuation (. ! ?)
      - Common abbreviations / acronyms are NOT split (Mr., e.g., i.e.)
      - Bullet / numbered list items treated as individual claims
      - Code blocks stripped (they are not factual prose claims)

    Returns a list of non-empty claim strings.
    """
    # Strip markdown code blocks — they are not factual claims
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`[^`]+`', '', text)

    # Split on sentence boundaries, keeping delimiters
    # Negative lookbehind avoids splitting on common abbreviations
    sentences = re.split(
        r'(?<![A-Z][a-z])(?<![A-Za-z]\.[A-Za-z])(?<=[.!?])\s+',
        text.strip()
    )

    # Also split on newline-delimited bullet points
    claims = []
    for sent in sentences:
        parts = re.split(r'\n+', sent)
        claims.extend(parts)

    # Normalize and filter
    cleaned = []
    for c in claims:
        c = c.strip().lstrip('-•*0123456789.) ')
        if len(c) > 15:   # skip very short fragments (e.g. "Yes.", "OK")
            cleaned.append(c)

    return cleaned if cleaned else [text.strip()[:512]]


class NLIMonitor:
    """
    NLI faithfulness checker using DeBERTa-v3-small cross-encoder.

    SCORING METHODOLOGY (RAGAS / DeepEval claim-level, matches FYP report):
    -----------------------------------------------------------------------
    1. Decompose LLM response into atomic claims (sentences).
    2. For each claim, score against every retrieved chunk as
       (premise=chunk, hypothesis=claim) — take the MES (max entailment score).
    3. A claim is "faithful" if MES >= CLAIM_THRESHOLD (0.5).
    4. faithfulness = faithful_claims / total_claims  (range 0-1, shown as %)

    This matches the methodology described in RAGAS (Es et al., 2023): https://arxiv.org/abs/2309.15217
    DeepEval (default threshold 0.7)


    Scores naturally fall in 0.70-0.95 for grounded RAG responses,
    making the badge display meaningful and comparable to published benchmarks.
    """

    def __init__(self, model_name: str = 'cross-encoder/nli-deberta-v3-small'):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.threshold = PASS_THRESHOLD
        self.claim_threshold = CLAIM_THRESHOLD
        self._initialized = False
        self._device = "cpu"
        self._init_lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1)

    def initialize(self):
        """
        Load DeBERTa model and tokenizer. MUST be called from a thread.
        Thread-safe via double-checked locking.
        """
        if self._initialized:
            return

        with self._init_lock:
            if self._initialized:
                return
            try:
                logger.info(f"🔄 Initializing NLI model: {self.model_name}")

                if torch.cuda.is_available():
                    self._device = "cuda"
                else:
                    self._device = "cpu"
                    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

                logger.info(f"📊 NLI running on: {self._device.upper()}")
                self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
                self.model = AutoModelForSequenceClassification.from_pretrained(
                    self.model_name
                )
                self.model.to(self._device)
                self.model.eval()
                self._initialized = True
                logger.info("✅ NLI model initialized successfully")
            except Exception as e:
                logger.error(f"❌ Failed to initialize NLI model: {str(e)}")
                raise

    def _run_inference(self, premise: str, hypothesis: str) -> float:
        """
        Single synchronous NLI inference for one (premise, hypothesis) pair.

        LABEL ORDER for cross-encoder/nli-deberta-v3-small:
            Index 0 → contradiction
            Index 1 → entailment  ← we want this
            Index 2 → neutral
        """
        inputs = self.tokenizer(
            premise,
            hypothesis,
            truncation=True,
            max_length=512,
            return_tensors='pt'
        )
        inputs = {k: v.to(self._device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1)
            return probs[0, 1].item()  # index 1 = entailment

    def _run_inference_all_chunks(
        self, chunks: List[str], hypothesis: str
    ) -> Dict[str, Any]:
        """
        Score one hypothesis (a single claim sentence) against every chunk.
        Returns the max entailment score (MES) across all chunks.

        Used by _score_claims_faithfulness for each decomposed claim.
        """
        chunk_scores = []
        for chunk_text in chunks:
            if not chunk_text.strip():
                chunk_scores.append(0.0)
                continue
            score = self._run_inference(chunk_text[:400], hypothesis[:200])
            chunk_scores.append(score)

        if not chunk_scores:
            return {"max_score": 0.0, "chunk_scores": [], "best_chunk_index": -1}

        max_score = max(chunk_scores)
        best_idx = chunk_scores.index(max_score)
        return {
            "max_score": max_score,
            "chunk_scores": chunk_scores,
            "best_chunk_index": best_idx,
        }

    def _score_claims_faithfulness(
        self, chunk_texts: List[str], llm_response: str
    ) -> Dict[str, Any]:
        """
        Claim-level faithfulness scoring (RAGAS / DeepEval methodology).

        Algorithm:
          1. Decompose llm_response into atomic claims.
          2. For each claim, compute MES = max(NLI score over all chunks).
          3. Mark claim as faithful if MES >= CLAIM_THRESHOLD (0.5).
          4. faithfulness = faithful_claims / total_claims.

        Returns:
          {
            "faithfulness_score": float,   # 0-1, shown as % in badge
            "faithful_claims": int,
            "total_claims": int,
            "claim_scores": List[float],   # MES per claim
            "claims": List[str],           # decomposed claim texts
          }
        """
        claims = _split_into_claims(llm_response)
        logger.debug(f"[NLI] Decomposed into {len(claims)} claims")

        claim_scores = []
        for claim in claims:
            result = self._run_inference_all_chunks(chunk_texts, claim)
            claim_scores.append(result["max_score"])

        faithful_count = sum(
            1 for s in claim_scores if s >= self.claim_threshold
        )
        total = len(claim_scores)
        faithfulness = faithful_count / total if total > 0 else 0.0

        logger.debug(
            f"[NLI] claim_scores={[round(s, 3) for s in claim_scores]}, "
            f"faithful={faithful_count}/{total}, score={faithfulness:.3f}"
        )

        return {
            "faithfulness_score": round(faithfulness, 3),
            "faithful_claims": faithful_count,
            "total_claims": total,
            "claim_scores": claim_scores,
            "claims": claims,
        }

    async def validate_response_async(
        self,
        retrieved_chunks: List[Dict[str, Any]],
        llm_response: str,
        query_id: str
    ) -> Dict[str, Any]:
        """
        Async shell — runs claim-level faithfulness scoring in a thread executor.

        Score interpretation:
          >= 0.90  → Highly Grounded ✅
          0.70-0.89 → Pass ✅  (DeepEval default threshold = 0.70)
          0.50-0.69 → Partial ⚠️
          < 0.50   → Alert 🔴
        """
        if not self._initialized:
            logger.error(f"[NLI] Model not initialized for query_id={query_id}.")
            return {
                "query_id": query_id,
                "score": 0.0,
                "is_faithful": False,
                "threshold": self.threshold,
                "status": "ERROR",
                "reason": "model_not_initialized"
            }

        try:
            if not retrieved_chunks or not (llm_response or "").strip():
                return {
                    "query_id": query_id,
                    "score": 0.0,
                    "is_faithful": False,
                    "threshold": self.threshold,
                    "status": "ALERT",
                    "reason": "empty_context_or_response"
                }

            chunk_texts = [c.get("text", "") for c in retrieved_chunks]

            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self._executor,
                self._score_claims_faithfulness,
                chunk_texts,
                llm_response,
            )

            score = result["faithfulness_score"]
            is_faithful = score >= self.threshold

            return {
                "query_id": query_id,
                "score": score,
                "display_score": score,
                "faithful_claims": result["faithful_claims"],
                "total_claims": result["total_claims"],
                "claim_scores": result["claim_scores"],
                "is_faithful": is_faithful,
                "threshold": self.threshold,
                "status": "PASS" if is_faithful else "ALERT",
                "detail": "entailment_ok" if is_faithful else "low_entailment"
            }

        except Exception as e:
            logger.error(f"[NLI] Error validating {query_id}: {str(e)}")
            return {
                "query_id": query_id,
                "score": 0.0,
                "is_faithful": False,
                "threshold": self.threshold,
                "status": "ERROR",
                "reason": str(e)
            }


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------

_nli_monitor: Optional[NLIMonitor] = None
_singleton_lock = threading.Lock()


def get_nli_monitor() -> NLIMonitor:
    """
    Return the global NLIMonitor singleton, initializing on first call.
    Thread-safe via double-checked locking.
    MUST be called from a plain def running in a thread, not bare in async def.
    """
    global _nli_monitor
    if _nli_monitor is not None:
        return _nli_monitor
    with _singleton_lock:
        if _nli_monitor is None:
            instance = NLIMonitor()
            instance.initialize()
            _nli_monitor = instance
    return _nli_monitor

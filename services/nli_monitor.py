# services/nli_monitor.py

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
# THRESHOLD — matches the empirically validated value from the FYP report.
#
# The 0.65 threshold is valid ONLY when NLI is run per-chunk (one call per
# retrieved chunk, take the max score). Running it on a concatenated blob
# of all chunks collapses the score to ~0.01-0.05 because the 512-token
# window gets split across premise+hypothesis unevenly.
#
# Per-chunk scoring replicates what was done during offline development
# testing (97% faithfulness, n=50), and is what the report describes:
#   "scores each retrieved chunk against the response as a premise-hypothesis pair"
# ---------------------------------------------------------------------------
PASS_THRESHOLD = 0.65


class NLIMonitor:
    """
    NLI faithfulness checker using DeBERTa-v3-small cross-encoder.

    DESIGN RATIONALE:
    -----------------
    PyTorch inference is synchronous and CPU-bound. Calling it directly
    inside an `async def` freezes FastAPI's event loop until inference finishes.

    Solution: ALL blocking work (init + inference) goes through
    run_in_executor so the event loop is never touched by CPU-bound code.

    SCORING METHODOLOGY (matches FYP report Section 4.3):
    ------------------------------------------------------
    Each retrieved chunk is scored independently against the LLM response
    as a (premise=chunk, hypothesis=response) pair.
    Final score = max(chunk scores).

    This is critical: DeBERTa is a cross-encoder trained on sentence pairs.
    Concatenating all chunks into one long string before scoring dilutes the
    semantic signal and causes scores to collapse to ~0.01-0.05 even for
    correct answers. Per-chunk scoring recovers the 0.65+ range seen in
    development testing.

    DISPLAY SCORE:
    --------------
    The raw max score (0-1) is returned as-is. For the badge, scores are
    shown as percentages directly (e.g. 0.72 → "72%"), which is meaningful
    because the 0.65 threshold means "65% = minimum pass". Students see
    scores in a range they can interpret relative to the threshold.
    """

    def __init__(self, model_name: str = 'cross-encoder/nli-deberta-v3-small'):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.threshold = PASS_THRESHOLD
        self._initialized = False
        self._device = "cpu"

        # threading.Lock (not asyncio.Lock) — initialize() is always called
        # from threads, never from coroutines
        self._init_lock = threading.Lock()

        # Single-worker executor serializes inference calls — prevents concurrent
        # threads from racing on shared model weights
        self._executor = ThreadPoolExecutor(max_workers=1)

    def initialize(self):
        """
        Load DeBERTa model and tokenizer. MUST be called from a thread.

        Thread-safe via double-checked locking.
        Called automatically by get_nli_monitor() on singleton creation.

        DEVICE SELECTION:
          Always CPU for this model. MPS (Apple Silicon) is intentionally
          skipped because DebertaV2 uses ops (e.g. disentangled attention)
          that are not fully supported by MPS and cause silent hangs on M1/M2.
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
        Pure synchronous inference for a single (premise, hypothesis) pair.

        LABEL ORDER for cross-encoder/nli-deberta-v3-small:
            Index 0 → contradiction
            Index 1 → entailment  ← we want this
            Index 2 → neutral

        Each chunk text is passed as premise individually (see
        _run_inference_all_chunks). Do NOT concatenate chunks before calling
        this — doing so collapses the entailment score.
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
        Score each chunk individually against the hypothesis and return
        the max score plus per-chunk breakdown.

        This is the correct methodology described in the FYP report (Section 4.3):
        "scores each retrieved chunk against the response as a
        premise-hypothesis pair"

        Returns a dict with:
          - max_score: float — the highest entailment score across all chunks
          - chunk_scores: List[float] — score per chunk (for debug/logging)
          - best_chunk_index: int — which chunk had the highest score
        """
        chunk_scores = []
        for chunk_text in chunks:
            if not chunk_text.strip():
                chunk_scores.append(0.0)
                continue
            # Truncate individual chunk to 400 chars to leave room for hypothesis
            # in the 512-token window (premise + hypothesis share the window)
            score = self._run_inference(chunk_text[:400], hypothesis)
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

    async def validate_response_async(self,
                                      retrieved_chunks: List[Dict[str, Any]],
                                      llm_response: str,
                                      query_id: str) -> Dict[str, Any]:
        """
        Async shell only — contains NO blocking code.

        Scores each retrieved chunk individually against the LLM response,
        takes the max entailment score, and compares against PASS_THRESHOLD (0.65).

        The displayed score is the raw max score as a percentage, e.g.:
          0.72 → "72% grounded" (PASS, above 0.65 threshold)
          0.41 → "41% grounded" (ALERT, below 0.65 threshold)

        This is interpretable because the threshold itself is 65%, so students
        and teachers can understand what the percentage means relative to pass/fail.
        """
        if not self._initialized:
            logger.error(
                f"[NLI] Model not initialized for query_id={query_id}. "
                "initialize() must be called at startup."
            )
            return {
                "query_id": query_id,
                "score": 0.0,
                "is_faithful": False,
                "threshold": self.threshold,
                "status": "ERROR",
                "reason": "model_not_initialized — check startup logs"
            }

        try:
            if not retrieved_chunks or not llm_response.strip():
                return {
                    "query_id": query_id,
                    "score": 0.0,
                    "is_faithful": False,
                    "threshold": self.threshold,
                    "status": "ALERT",
                    "reason": "empty_context_or_response"
                }

            # Extract text from each chunk — score individually, not concatenated
            chunk_texts = [c.get("text", "") for c in retrieved_chunks]
            hypothesis = llm_response[:512]

            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self._executor,
                self._run_inference_all_chunks,
                chunk_texts,
                hypothesis,
            )

            max_score = result["max_score"]
            is_faithful = max_score >= self.threshold

            logger.debug(
                f"[NLI] query_id={query_id}, "
                f"chunk_scores={[round(s, 3) for s in result['chunk_scores']]}, "
                f"max={max_score:.3f}, "
                f"best_chunk={result['best_chunk_index']}, "
                f"faithful={is_faithful}"
            )

            return {
                "query_id": query_id,
                "score": round(max_score, 3),           # raw score (0-1)
                "display_score": round(max_score, 3),   # same — shown as % in badge
                "chunk_scores": result["chunk_scores"],
                "best_chunk_index": result["best_chunk_index"],
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
# Global singleton — one NLIMonitor instance for the entire process lifetime.
# get_nli_monitor() MUST be called from a thread, never bare in async def.
# ---------------------------------------------------------------------------

_nli_monitor: Optional[NLIMonitor] = None
_singleton_lock = threading.Lock()


def get_nli_monitor() -> NLIMonitor:
    """
    Return the global NLIMonitor singleton, initializing it on first call.

    Thread-safe via double-checked locking.

    CALL SITE RULES:
      ✅ Inside a plain def running in a thread (_run_nli_and_save)
      ✅ Via run_in_executor at startup
      ❌ Never call bare in async def
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

# services/nli_monitor.py

import asyncio
import torch
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from typing import List, Dict, Any, Optional


logger = logging.getLogger(__name__)


class NLIMonitor:
    """
    NLI faithfulness checker using DeBERTa-v3-small cross-encoder.

    DESIGN RATIONALE:
    -----------------
    PyTorch inference is synchronous and CPU-bound. Calling it directly
    inside an `async def` freezes FastAPI's event loop until inference finishes.

    Solution: ALL blocking work (init + inference + DB writes) goes through
    run_in_executor so the event loop is never touched by CPU-bound code.

    INITIALIZATION CONTRACT:
    ------------------------
    initialize() is called by get_nli_monitor() at singleton creation time,
    inside a thread. It must NEVER be called bare inside async def.

    validate_response_async() is an async shell only — hands off all work
    to _run_inference() via run_in_executor.
    """

    def __init__(self, model_name: str = 'cross-encoder/nli-deberta-v3-small'):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.threshold = 0.65
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

        Blocking operations inside:
          - HuggingFace HTTP HEAD requests (network I/O)
          - Model weight loading from disk (~250MB file I/O)
          - Tensor allocation and device transfer (CPU-bound)

        Thread-safe via double-checked locking.
        Called automatically by get_nli_monitor() on singleton creation.
        """
        if self._initialized:
            return

        with self._init_lock:
            if self._initialized:
                return
            try:
                logger.info(f"🔄 Initializing NLI model: {self.model_name}")
                self._device = "cuda" if torch.cuda.is_available() else "cpu"
                logger.info(f"📊 NLI running on: {self._device.upper()}")
                self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
                self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
                self.model.to(self._device)
                self.model.eval()
                self._initialized = True
                logger.info("✅ NLI model initialized successfully")
            except Exception as e:
                logger.error(f"❌ Failed to initialize NLI model: {str(e)}")
                raise

    def _run_inference(self, premise: str, hypothesis: str) -> float:
        """
        Pure synchronous inference — called directly from _run_nli_and_save in a thread.

        MUST be indented inside the class (4 spaces) so it becomes an instance
        method accessible as monitor._run_inference(...).

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

    async def validate_response_async(self,
                                      retrieved_chunks: List[Dict[str, Any]],
                                      llm_response: str,
                                      query_id: str) -> Dict[str, Any]:
        """
        Async shell only — contains NO blocking code.

        Fails fast with ERROR if model not initialized (never lazy-inits).
        Dispatches _run_inference to self._executor via run_in_executor.
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

            premise = " ".join([c.get("text", "") for c in retrieved_chunks])[:1024]
            hypothesis = llm_response[:512]

            loop = asyncio.get_event_loop()
            entailment_score = await loop.run_in_executor(
                self._executor,
                self._run_inference,
                premise,
                hypothesis
            )

            is_faithful = entailment_score >= self.threshold
            logger.debug(
                f"[NLI] query_id={query_id}, score={entailment_score:.3f}, "
                f"faithful={is_faithful}"
            )
            return {
                "query_id": query_id,
                "score": round(entailment_score, 3),
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
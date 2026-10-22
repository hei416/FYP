# RAG pipeline

**Parts:** `rag_system.py` (core pipeline), `routers/rag.py` (API, rate-limited 30 req/min), `services/rag_helpers.py`, `services/classroom_rag.py` (classroom-scoped retrieval), `services/nli_monitor.py` (NLI faithfulness checks — answers must be grounded in retrieved docs).

**Stores:** FAISS indexes in `vectorstore/` (`java_knowledge`, `platform_guide`, ~6.4 MB) — **committed deliberately** for fast Azure startup. Metadata in `vectorstore/faiss_summary.json`.

**Rules:**
- Use **per-request retriever instances** — module-level retriever singletons cause stale-state bugs (README warning).
- Never hand-edit `index.faiss`; inspect with `vectorstore/extract_from_faiss.py`.
- Rebuild via `python rebuild_vectorstore.py` — but note this changes tracked binaries and a push then deploys the backend (see [../OPS.md](../OPS.md)).

**Known gaps:** retrieval-only fallback when the LLM is down is not fully implemented in `routers/rag.py` (backlog); `local_llm_fallback.py` (Llama 2 CPU) is disabled via `OLLAMA_FALLBACK_ENABLED=False`.

**How to test:** no offline unit tests exist. Verify imports (`python -c "import rag_system"`), then exercise `/ragAI` against a running backend with a real `API_KEY`.

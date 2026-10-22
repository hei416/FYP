# backend/services/ — business logic

The logic layer behind [`../routers/`](../routers/AGENTS.md). New behavior goes here (a router should only parse the request and call a service).

| File | Does |
|---|---|
| `classroom_rag.py` | classroom-scoped RAG retrieval (separate pipeline from the global one) |
| `conversation_manager.py` | conversation state/history |
| `error_explainer.py` | Java error explanation (rate-limited endpoint in routers) |
| `nli_monitor.py` | NLI faithfulness check on RAG answers — the production guard, also reused as the offline eval metric |
| `rag_helpers.py` | shared RAG utilities |

## Rules

- RAG code: use **per-request retriever instances** — module-level retriever singletons cause stale-state bugs. Details: [docs/modules/rag-pipeline.md](../../docs/modules/rag-pipeline.md).
- No offline unit tests cover the RAG pipeline itself — verify with `python -c "import services.rag_system"` from `backend/`, then exercise `/ragAI` against a running backend.

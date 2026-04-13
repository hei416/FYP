# 🎤 LLM FALLBACK STRATEGY - PRESENTATION QUICK CARD

**Print this or keep nearby during FYP presentation**

---

## ⏱️ TIMING
- **Mention during:** Segment 4 - Technical Highlights (1-2 minutes)
- **If deep dive:** Show files + discuss resilience philosophy (3-5 minutes)

---

## 💬 MAIN TALKING POINT (Read This if Nervous!)

> **"An important aspect of system design is resilience. We use HKBU's qwen3-max LLM — 97% accuracy, free via university. But if it fails, we gracefully degrade: instead of an error, students see course documents. We've also documented a CPU-only Llama 2 fallback for future scalability, showing production thinking."**

---

## 📌 KEY MESSAGES TO CONVEY

1. ✅ **HKBU qwen3-max is primary** (97% accurate, $0)
2. ✅ **Retrieval-only fallback** (graceful degradation, $0)
3. ✅ **Future-ready:** Llama 2 documented but not active
4. ✅ **Cost-conscious:** No paid APIs = sustainable

---

## 🗂️ FILES TO REFERENCE

| File | Show When | What It Proves |
|------|-----------|----------------|
| `local_llm_fallback.py` | Asked about fallback | Full architecture design |
| `rag_system.py` (lines 28-45) | Asked about LLM | Primary = HKBU, no OpenAI |
| `main.py` (lines 72-77) | Asked about resilience | Design built in from start |

---

## 🎯 PROFESSOR QUESTIONS & ANSWERS

| Question | Your Answer |
|----------|-------------|
| **"Why no OpenAI?"** | Costs $5-30/mo. Retrieval-only fallback better (free + helpful). Shows cost-consciousness. |
| **"Why Llama 2?"** | 70-75% accuracy, CPU-only (no GPU), open-source, 16GB memory fits anywhere. Well-documented for future. |
| **"Will this be used?"** | Not for FYP, but architecture ready. Shows long-term thinking, not just demo features. |
| **"How resilient?"** | Dual fallback: primary fails → retrieval-only. Won't crash, always helpful. |

---

## 🚀 OPTIONAL: LIVE CODE DEMO (If You Want to Impress)

```bash
# Shows your LLM configuration is loaded and ready:
python -c "from local_llm_fallback import current_llm_chain; import json; print(json.dumps(current_llm_chain(), indent=2))"
```

**Say:** "This shows our current setup — 97% quality with zero-cost fallback."

---

## ❌ DON'T DO THIS

- ❌ Activate GPU server fallback (shared resource, risky)
- ❌ Spend more than 2 min on this unless directly asked
- ❌ Say "we might add" — say "we've designed for and documented"

---

## ✨ REMEMBER

This shows you're thinking like an engineer, not just a student:
- **前瞻** (foresight): Planned future enhancement
- **完整** (completeness): Full resilience strategy
- **专业** (professional): Production-ready architecture

**You've got this! 🎉**

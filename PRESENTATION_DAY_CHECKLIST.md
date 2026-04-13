# Presentation Day Checklist & Tech Setup

---

## 📋 BEFORE PRESENTATION (1 hour prior)

### Environment Setup

- [ ] **Terminal 1: Backend**
  ```bash
  cd /Users/hei/IdeaProjects/fyp
  source .venv/bin/activate
  uvicorn main:app --reload --port 8000
  ```
  - Verify: See message like `Application startup complete [INFO]`
  - Check: No errors in logs

- [ ] **Terminal 2: Frontend**
  ```bash
  cd /Users/hei/IdeaProjects/fyp/frontend
  npm start
  ```
  - Verify: Webpack compilation succeeds, see `Compiled successfully!`
  - Wait for app to load at `http://localhost:3000`

- [ ] **Terminal 3: Optional – Terminal Service** (if showing interactive I/O)
  ```bash
  cd /Users/hei/IdeaProjects/fyp/terminal-service
  npm install (if not already done)
  node server.js
  ```
  - Verify: See `Terminal service running on port 3001`

### Browser Preparation

- [ ] Open Chrome/Safari/Firefox to `http://localhost:3000`
- [ ] If on fresh machine, clear cache: `Cmd+Shift+Delete` → clear all history
- [ ] **Login as test user:**
  - Email: `test@test.com`
  - Password: `test1234`
  - Verify: Successfully logged in, see Course Catalog

- [ ] **Navigate through each demo section and verify it loads:**
  - ✅ Course Catalog page loads
  - ✅ Click Basic Java → Roadmap loads (see topic circles)
  - ✅ Click a topic → Topic detail loads with AI tutor panel
  - ✅ Try typing in AI tutor chat (test with simple question)
  - ✅ Navigate to Playground → loads and can run code
  - ✅ Navigate to Exercises → loads quiz list
  - ✅ Navigate to Coding Challenges → loads challenges
  - ✅ Navigate to Progress/Dashboard (check if available)

### API Health Check

- [ ] Open `http://localhost:8000/docs` (Swagger UI)
- [ ] Key endpoints to verify exist:
  - `POST /auth/login`
  - `GET /lessons/{topic_id}`
  - `POST /ragAI/chat`
  - `POST /code/execute`
  - `GET /quizzes/{quiz_id}`
  - `GET /practical-tests/{test_id}`

### Network & Screen Setup

- [ ] **Internet connection:** Stable WiFi or ethernet
- [ ] **Display resolution:** Test that all UI is readable on projector
  - If presenting via HDMI, test connection and resolution
  - Try zooming browser if text too small: `Cmd+Plus` (or Ctrl+Plus)

- [ ] **Backup screenshots:** Have 5-10 PNG screenshots ready:
  - Login screen
  - Roadmap
  - Topic detail
  - AI chat example
  - Quiz result
  - Challenge result
  - Save to Desktop or USB

- [ ] **Backup slides:** Presentation outline already in `PRESENTATION_45MIN_OUTLINE.md`

---

## 🎯 PRESENTATION ROOM CHECKLIST (15 min before)

### Equipment

- [ ] Projector or large monitor connected
- [ ] Test resolution and color quality (read text on screen)
- [ ] Sound working (if needed for demo or video)
- [ ] Microphone ready (if large room)
- [ ] Backup: Laptop plugged in (power cord nearby)

### Physical Setup

- [ ] Water bottle or mints nearby (dry mouth from talking)
- [ ] Clicker or keyboard ready for navigation
- [ ] Notes/notecards printed with demo flow (optional)
- [ ] Extra USB with demo videos/screenshots (backup)

### Mental Preparation

- [ ] Review the presentation outline one more time
- [ ] Review demo script (DEMO_SCRIPT_DETAILED.md)
- [ ] Do a quick 2-min dry run of the demo flow
- [ ] Identify 2-3 "showstopper" features to emphasize:
  - AI tutor RAG system
  - Auto-grading at scale
  - Personalized progress tracking

---

## ⚡ QUICK TECH TROUBLESHOOTING

If something doesn't work right before presentation:

### Frontend won't load (blank page)
```bash
# Check for port conflict
lsof -ti:3000 | xargs kill -9
# Rebuild
cd frontend && npm install && npm start
```

### Backend API failing
```bash
# Check Python env
source .venv/bin/activate
# Check logs for errors
uvicorn main:app --reload --port 8000 2>&1 | head -20
# If 500 error, might be DB issue
python migrate_to_postgres.py  # reset DB if needed
```

### AI tutor chat not responding
- Check: Is backend receiving requests? (check `http://localhost:8000/docs` alive)
- Check: FAISS index loaded? (`./vectorstore/index.faiss` exists and is >1MB)
- If missing, rebuild: `python rebuild_vectorstore.py 2>&1`

### Code execution failing (Playground returns error)
- Check: Is `PAIZA_API_KEY` set in environment?
  ```bash
  echo $PAIZA_API_KEY  # should show a key, not empty
  ```
- If empty, export it:
  ```bash
  export PAIZA_API_KEY="your_key_here"
  uvicorn main:app --reload
  ```

### Quiz/Challenge data not loading
- Might be database issue
- Try: `python migrate_to_postgres.py --reset` (will wipe and recreate DB)
- Alternative: Use SQLite (should have demo data pre-loaded)

---

## 📱 DEMO FLOW CHECKLIST (during presentation)

**Use this to track where you are:**

- [ ] **Segment 1 (5 min):** Problem statement and motivation
- [ ] **Segment 2 (4 min):** Platform overview (features, user roles)
- [ ] **Segment 3 (15 min):** Live demo
  - [ ] Login → Course catalog (1.5 min)
  - [ ] Course selection (1 min)
  - [ ] Roadmap (1.5 min)
  - [ ] Topic detail & AI tutor (3 min)
  - [ ] Code playground (2 min)
  - [ ] Quiz (2 min)
  - [ ] Challenge (2-3 min)
  - [ ] Progress dashboard (1 min, optional)
- [ ] **Segment 4 (8 min):** Technical highlights (RAG, progress tracking, classroom)
- [ ] **Segment 5 (4 min):** Learning outcomes & impact
- [ ] **Segment 6 (2 min):** Architecture overview
- [ ] **Segment 7 (2 min):** Challenges & future work
- [ ] **Segment 8 (2-3 min):** Closing & Q&A
- [ ] **Buffer:** Time for questions from professor

---

## 🎤 PRESENTATION DAY REMINDERS

### During Presentation

- ✅ **Speak clearly.** You're excited about your project—let it show
- ✅ **Make eye contact** with the professor (not just screen)
- ✅ **Avoid dead air.** Always narrate what's happening
- ✅ **Go slow.** Prof is seeing it for the first time; don't rush
- ✅ **Smile.** You built something cool; be proud

### If Demo Breaks Mid-Presentation

- 🆘 **Stay calm.** Say: "Let me quickly reconnect—meanwhile, let me explain this feature."
- 🆘 **Pivot to verbal:** Describe the flow while troubleshooting
- 🆘 **Show code:** Open `rag_system.py` or `routers/` folder, explain logic
- 🆘 **Offer to re-demo later:** "After the presentation, I can show you the live version if you'd like."
- 🆘 **Show screenshots:** Have PNGs ready as backup

### Common Professor Questions (Be Ready!)

1. **"How do you ensure data privacy?"**
   - > "User data is password-protected and stored securely. Each user session is isolated. No student data leaves the platform."

2. **"What's novel about this compared to ChatGPT or Khan Academy?"**
   - > "RAG + curriculum-aware = accurate answers tied to Java docs. Classroom integration = teachers control content. Auto-grading at scale = no human bottleneck."

3. **"How would you measure learning impact?"**
   - > "We track metric progress: quiz scores, challenge pass rates, time to solve, weak area detection. We could A/B test with/without AI tutor."

4. **"What's the hardest technical challenge?"**
   - > "Getting RAG to be accurate without hallucinating. We solved this by indexing only verified sources (Java docs + our materials). Also, code execution safety—using Paiza API for sandboxing."

5. **"Can teachers cheat the system (e.g., grade manipulation)?"**
   - > "Teachers set policies; auto-grading is transparent. For open-ended assignments, we have code plagiarism checks. Admin logs all grade changes."

---

## 🔬 NLI FAITHFULNESS MONITORING (NEW FEATURE)

### What It Is

Every RAG response is validated asynchronously using a DeBERTa-v3-small NLI cross-encoder:
- ✅ Response returned **immediately** to student (zero latency overhead)
- ✅ Faithfulness check runs in **background** without blocking
- ✅ Results logged to `nli_monitoring_logs` table for admin review
- ✅ Admin dashboard at `GET /admin/nli-monitoring/stats` shows quality metrics

### How to Demo

**Step 1: Submit a query**
```bash
curl -X POST http://localhost:8000/ragAI \
  -H "Content-Type: application/json" \
  -d '{"user_input": "What is Java?", "user_id": 1}'
```

**Expected response includes:**
```json
{
  "final_answer": "...",
  "query_id": "a51c5c13-221f-48a1-a7f0-ce99140def8d",
  "debug_log": {
    "nli_monitoring": "async_background"
  }
}
```

**Step 2: Wait 2-3 seconds, then check logs**
```bash
source .venv/bin/activate && python -c "
from database import SessionLocal
from db_models import NLIMonitoringLog
from datetime import datetime, timedelta

db = SessionLocal()
cutoff = datetime.utcnow() - timedelta(minutes=1)
logs = db.query(NLIMonitoringLog).filter(
    NLIMonitoringLog.checked_at >= cutoff
).order_by(NLIMonitoringLog.checked_at.desc()).all()

for log in logs[:3]:
    print(f'Query: {log.query_id}')
    print(f'  Score: {log.nli_score:.3f} | Faithful: {log.is_faithful} | Status: {log.status}')
db.close()
"
```

**Expected output:**
```
Query: a51c5c13-221f-48a1-a7f0-ce99140def8d
  Score: 0.927 | Faithful: True | Status: PASS
```

**Step 3: Check admin dashboard**
```bash
curl -s http://localhost:8000/admin/nli-monitoring/stats?hours=1 | python -m json.tool
```

### What to Say During Presentation

> **"A key quality feature is our NLI faithfulness monitoring. Every RAG response is validated to ensure it's grounded in the retrieved documents. The check runs asynchronously in the background—students see answers instantly—while we log quality metrics for administrators. This gives educators confidence that the AI tutor isn't hallucinating."**

### If Professor Asks: "How do you ensure the AI isn't making things up?"

> **"We use a cross-encoder NLI model (DeBERTa) that compares the retrieved documents against the generated response. If they don't align (entailment score < 0.65), it's flagged in our monitoring dashboard. This gives us both real-time quality assurance and long-term trend analysis."**

---

### Where This Fits in Your Presentation

**Best time to mention:** During "Technical Highlights" segment (Segment 4)  
**Duration:** 1-2 minutes  
**Objective:** Show 前瞻 (foresight) and 完整 (completeness) of system design

### Presentation Script — Say This:

> **"An important aspect of our system design is resilience architecture for the AI tutor backend.**
>
> **Currently, the system uses HKBU's qwen3-max LLM — it's free through university infrastructure and achieves 97% accuracy on our benchmark.**
>
> **But what if the primary service goes down?** We've designed a dual-fallback strategy:
>
> **1) Primary:** HKBU qwen3-max via our university API — high quality, zero external API costs
>
> **2) If that fails, the system gracefully degrades to retrieval-only mode** — instead of showing an error, we return relevant course documents along with a helpful message. Students still get useful learning materials even if the AI is temporarily down.
>
> **3) For future enhancement** — and this shows architectural thinking — we've documented a CPU-only Llama 2 7B fallback option. This doesn't require GPU servers; it uses local CPU inference. It's not active for this FYP, but it demonstrates forward planning.
>
> **Why does this matter?** It shows we're thinking about production resilience, not just demo-time functionality. The platform won't catastrophically fail if one service is down — it gracefully degrades to still help students learn."

### What to Show (If Examiners Ask)

**Show these files:**

1. **`local_llm_fallback.py`** (345 lines) — Architecture documentation
   - Open in editor: `cat local_llm_fallback.py`
   - Shows: Cost comparison table, setup instructions for future Llama 2 option
   - **Key point:** "This is intentionally not activated for FYP, but demonstrates the full resilience design"

2. **`rag_system.py`** (lines 28-45) — LLM initialization
   ```bash
   grep -A 15 "# LLM INITIALIZATION" /Users/hei/IdeaProjects/fyp/rag_system.py
   ```
   - Shows: Primary = HKBU, NO OpenAI (costs money), future = Llama 2 CPU
   - **Context:** "We deliberately avoided costly APIs; everything is free or internal"

3. **`main.py`** (lines 72-77) — Resilience architecture comment
   ```bash
   grep -A 5 "# Resilience Architecture" /Users/hei/IdeaProjects/fyp/main.py
   ```
   - Shows: System design philosophy at entry point
   - **Context:** "Resilience is built into the architecture from the start"

### Key Talking Points (Memorize These)

- ✅ **"Free infrastructure"** — HKBU qwen3-max costs nothing; no external API bills
- ✅ **"Graceful degradation"** — System doesn't crash; it falls back to retrieval mode
- ✅ **"Production-ready thinking"** — We designed for failure scenarios, not just happy path
- ✅ **"Future-proof"** — Documented Llama 2 option ready if we need it post-FYP
- ✅ **"No GPU dependency"** — CPU-only fallback is scalable to any machine

### If Professor Asks: "Why no OpenAI API as fallback?"

> **Your answer:**
> "Good question. OpenAI would add quality, but it costs $5-30/month in API charges. For a university project, that's not sustainable. Instead, we use retrieval-only fallback — it costs $0 and is actually quite helpful. Students still see relevant documents. This shows cost-consciousness in our design decisions."

### If Professor Asks: "Why Llama 2 and not other models?"

> **Your answer:**
> "Llama 2 7B is a good balance — 70-75% accuracy, fast enough on CPU (~10-15 seconds), and it's open-source so we're not dependent on any company. The 7B version fits in standard memory (~16GB), making it deployable anywhere. This is well-documented in `local_llm_fallback.py` if you want to review."

### If Professor Asks: "Will this actually be used?"

> **Your answer:**
> "For this FYP, no — we're focusing on qwen3-max quality. But the architecture is designed so we can activate it later. It's in the codebase, documented, and ready. This shows we've thought about long-term operations, not just initial deployment."

### How to Demo This Part (Optional, Advanced)

If you want to show code execution:

```bash
# Show the architecture is loaded
cd /Users/hei/IdeaProjects/fyp && \
source .venv/bin/activate && \
python -c "from local_llm_fallback import current_llm_chain; print(current_llm_chain())"
```

Output will show:
```
{
  'primary': 'HKBU qwen3-max (free, university API)',
  'fallback': 'Retrieval-only mode (documents + graceful message, $0)',
  'cost': '$0',
  'quality': '97% (HKBU) or retrieval-only (safe)'
}
```

**Narration while showing:**
> "This shows our current configuration — 97% quality primary with free fallback. Everything's zero cost."

---

## 📊 POST-PRESENTATION

After the presentation:

- [ ] **Thank the professor** for feedback
- [ ] **Ask for specific feedback:** "What feature seemed most valuable? What would you improve?"
- [ ] **Offer to answer follow-ups** via email or next meeting
- [ ] **Gather contact info** if prof wants to stay updated
- [ ] **Take a photo** of yourself with your work (celebrate! 🎉)

---

## 🔧 LAST-MINUTE SYSTEM COMMANDS

### Terminal 1: Backend (copy-paste ready)
```bash
cd /Users/hei/IdeaProjects/fyp && \
source .venv/bin/activate && \
uvicorn main:app --reload --port 8000
```

### Terminal 2: Frontend (copy-paste ready)
```bash
cd /Users/hei/IdeaProjects/fyp/frontend && \
npm start
```

### Check if ports are in use:
```bash
lsof -i :8000
lsof -i :3000
```

### Kill and restart (emergency):
```bash
pkill -f uvicorn
pkill -f "npm start"
sleep 2
# Then restart using commands above
```

---

## ✨ YOU'VE GOT THIS!

You have a **well-engineered, feature-rich platform** that solves a real problem. Your professor will see:
1. **Vision:** AI tutoring that scales
2. **Execution:** Professional architecture (React + FastAPI + RAG)
3. **Impact:** Measurable learning improvements
4. **Innovation:** RAG system, auto-grading, classroom integration

**Confidence is key.** You know your code. You know your users. You know your vision.

**Go present! 🚀**

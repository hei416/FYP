# CodeTutor: 45-Minute FYP Presentation Outline

**Duration:** 45 minutes (including Q&A buffer at end)  
**Audience:** FYP Professor  
**Focus:** Educational Impact & Learning Outcomes + Live Demos  
**Format:** Narrative + Interactive Demonstrations

---

## PRE-PRESENTATION CHECKLIST ✅

- [ ] Both backend and frontend running (`uvicorn main:app --reload` + `npm start`)
- [ ] Test account ready: `test@test.com` / `test1234`
- [ ] Network latency acceptable (or use local demo account)
- [ ] Browser bookmarks prepared for quick navigation
- [ ] Terminal ready for showing code if needed
- [ ] Screen recording on (optional backup)

---

## PRESENTATION STRUCTURE

### SEGMENT 1: PROBLEM & MOTIVATION (5 minutes)

**Key Message:** *"Learning to code is hard. Personalized guidance at scale is harder."*

**Talking Points:**
1. **The Challenge** (1 min)
   - Java has a steep learning curve (syntax, OOP concepts, debugging)
   - Students get stuck on specific topics
   - One-on-one tutoring doesn't scale
   - Generic online courses don't adapt to individual needs

2. **Educational Goals** (2 min)
   - Personalized learning paths (Basic vs Advanced)
   - Immediate feedback on mistakes (quizzes, code challenges)
   - AI-powered guidance on demand (ask questions anytime)
   - Progress visibility for motivation

3. **My Solution Premise** (2 min)
   - An **AI-powered Java tutor** that's **always available**
   - Understands the **curriculum** (Java docs, teaching materials)
   - Adapts to **individual progress**
   - Tracks learning outcomes (weak areas, mastery)

**Slide Suggestion:** Problem statement → Goal → Solution teaser

---

### SEGMENT 2: PLATFORM OVERVIEW (4 minutes)

**Key Message:** *"CodeTutor is a complete learning ecosystem, not just a chatbot."*

**Show Slide: Platform Architecture or Feature Map**

**Talking Points:**

1. **Three Main User Roles** (1 min)
   - **Students:** Learn Java through structured paths
   - **Teachers:** Create classrooms, organize materials, track progress
   - **Admins:** Oversee system health and user management

2. **Two Learning Paths** (1 min)
   - **Basic Java (12 topics):** Fundamentals → Intermediate
     - Variables, loops, OOP basics, inheritance, etc.
   - **Enhanced Java (8 topics):** Advanced concepts
     - Streams, concurrency, design patterns, algorithms
   - Students can progress through one path with tracked checkpoints

3. **Core Learning Features** (1.5 min)
   - 📚 **Topics & Lessons** with built-in AI tutor (RAG-powered)
   - 💻 **Code Playground:** Quick Java snippet execution
   - 📝 **Quizzes (Exercises):** MCQ assessments with auto-grading
   - 🎯 **Coding Challenges:** Auto-generated with example solutions
   - 📊 **Progress Dashboard:** Visual roadmap and weak area detection

4. **Classroom Mode** (optional for teaching) (0.5 min)
   - Teachers can create private classrooms
   - Upload materials (PDFs, documents)
   - AI tutor searches teacher materials + Java KB
   - Auto-generate quizzes from materials

**Slide Suggestion:** Use the platform guide doc as reference; show a visual flowchart of user journeys

---

### SEGMENT 3: LIVE DEMO – STUDENT LEARNING FLOW (15 minutes)

**Goal:** Show real learning in action

#### DEMO FLOW:

**Step 1: Login & Course Selection (1.5 min)**
- Use test account: `test@test.com` / `test1234`
- Show the **Course Catalog** (Courses page)
  - Explain: "Students can pick Basic or Enhanced Java"
  - Show: Both course cards, brief description
- Navigate to **Basic Java Roadmap**
  - Point out: 12 topics organized by difficulty
  - Highlight: Progress indicators (completed, in-progress, locked)
  - Talk about: **Structured learning progression**

*Talking Point:* "Rather than aimless learning, students see a clear curriculum with foundational topics first."

---

**Step 2: Select a Topic & Use AI Tutor (3 min)**
- Click on a topic (e.g., "Variables and Data Types")
- Show the **Topic Detail page:**
  - Overview text (explains the concept)
  - **✨ AI Tutor panel** on the right
  
**Sub-Demo: Ask AI a Question**
- Prompt: "Explain the difference between int and String"
- Show: AI response appears quickly
  - Highlight: **"The AI retrieves from Java KB + platform guide"** (RAG system)
  - Point out: Faithful, contextualized answer (not just vanilla GPT)
  - Mention: **"If student has follow-up, it continues the conversation"**

*Talking Point:* "This is personalized tutoring. The AI doesn't just chat—it knows Java docs, our curriculum, and can answer contextual questions in seconds."

---

**Step 3: Try the Code Playground (3 min)**
- Navigate to **Code Playground** (💻)
- Show the simple editor with some sample code (e.g., "Hello World")
- Click **"Run Code"**
  - Explain: "Output appears instantly (Paiza API in backend)"
  - Highlight: **No setup needed—code runs in browser**
  
**Quick Variation:**
- Modify code to include an error (e.g., syntax error)
- Run again → show error feedback
- Discuss: "Students learn quickly from immediate feedback"

*Talking Point:* "Removing friction—students can experiment without local setup. This lowers entry barriers for beginners."

---

**Step 4: Take a Quiz (2 min)**
- Navigate to **Exercises** (📝)
- Show a quiz (multiple choice questions)
- Select an answer and submit
  - Show: Immediate feedback ✅ or ❌
  - If correct: Points awarded, moves to next question
  - If wrong: Explanation provided
- Show the **Quiz Results** after completion
  - Highlight: Score, time taken, breakdown

*Talking Point:* "Quizzes reinforce learning with instant feedback. No waiting for grades—students know immediately."

---

**Step 5: Attempt a Coding Challenge (2.5 min)**
- Navigate to **Coding Challenges** (🎯)
- Show a challenge (e.g., "Write a method to find max in an array")
- Explain the panel:
  - Problem statement
  - Example input/output
  - **Solution code area** (pre-filled template)

**Sub-Demo: Run Test Cases**
- Modify solution (or use provided)
- Click **"Run Tests"**
  - Show: Test cases execute against student's code
  - Highlight: **Pass/fail for each test**
  - Discuss: **"Auto-grading scales—teacher can assign 50 students; system handles it"**

*Talking Point:* "Coding challenges provide hands-on practice with instant feedback. This is where learning becomes real."

---

**Demo Transitions Summary:**
- Total time: ~15 min
- You're showing the full student learning loop: theory → practice → feedback
- Emphasize: **Each step builds confidence**

---

### SEGMENT 4: TECHNICAL HIGHLIGHTS & INNOVATION (8 minutes)

**Key Message:** *"This isn't just a UI—there's intelligent systems behind it."*

**Note:** Speak to technical depth without going too deep; balance for education focus.

#### 4.1 AI Tutor System (RAG) – 3 minutes

**What is RAG?** (1 min)
- **Retrieval-Augmented Generation**
- Instead of: AI making up answers
- CodeTutor does: Search Java KB + Platform materials → pass to LLM → generate grounded answer
- Result: **Accurate, contextual, faithful to source**

**Show Diagram or Code Reference:**
- Can briefly show `rag_system.py` file structure
- Point out: "We use FAISS vectorstore to index Java docs and materials"
- Mention: "Search happens in <200ms, fast enough for real-time chat"

**Why This Matters for Learning:**
- Student doesn't get wildly incorrect advice
- AI cites what it learned from
- Teachers control materials → AI respects that content

---

#### 4.2 Dual Learning Paths & Progress Tracking – 2 minutes

**Show Progress Dashboard:**
- Navigate to a student's progress page (if available)
- Show: Visual progress bar for each topic
- Highlight: **"Weak areas detected automatically"**
  - E.g., "Inheritance topic – only 40% quiz accuracy"
  - System flags for review

**Why This Matters:**
- Prevents students from rushing past weak areas
- Enables targeted review
- Teachers can see at a glance who needs help

---

#### 4.3 Classroom & Teacher Tools – 2 minutes

**Quick Reference:**
- Teachers can create classrooms
- Upload materials (PDFs auto-indexed into AI system)
- Auto-generate quizzes from materials
- AI tutor searches materials + Java KB
- Dashboard shows student progress per classroom

**Why This Matters:**
- Bridges gap: personal tutoring + classroom scale
- Teachers control curriculum
- Centralized progress tracking

---

### SEGMENT 5: LEARNING OUTCOMES & IMPACT (4 minutes)

**Key Message:** *"How does CodeTutor improve student learning?"*

**Talking Points:**

1. **Immediate Feedback Loop** (1 min)
   - Error → Feedback → Retry → Success
   - Students don't wait for grading → motivation stays high
   - Mistakes become learning opportunities, not frustrations

2. **Personalized Pacing** (1 min)
   - Two paths let students choose depth
   - Progress tracking shows exactly where they stand
   - No one held back or left behind

3. **Availability & Scalability** (1 min)
   - Student stuck at 11 PM → AI tutor is there
   - Teacher to 50 students → auto-grading scales
   - No bottleneck on human instructor time

4. **Engagement Through Interactivity** (1 min)
   - Code playground is fun (write → run → modify → run)
   - Challenges feel like achievements (pass tests like game levels)
   - Chat history lets students review their learning journey

**Slide Suggestion:**
- Put quotes or hypothetical student feedback:
  - *"I can practice anytime, without being judged."*
  - *"I got instant feedback and understood my mistake immediately."*
  - *"The AI explained things in ways my textbook didn't."*

---

### SEGMENT 6: TECHNICAL ARCHITECTURE OVERVIEW (2 minutes)

**For completeness (if prof asks about internals):**

**Simple Diagram or Verbal:**
- **Frontend:** React, Tailwind CSS
  - Components: Roadmap, ChatUI, CodeEditor, Quiz, Dashboard
- **Backend:** FastAPI (Python)
  - Routes: `/lessons`, `/quizzes`, `/rag/chat`, `/code/execute`
  - Services handle business logic
- **Data Layer:** PostgreSQL + SQLite option
- **AI:** Qwen3-Max LLM + OpenAI embeddings + FAISS vectorstore
- **Code Execution:** Paiza API (runs untrusted Java code safely)

**Key Architectural Principles:**
- Separation of concerns (routers → services)
- Per-request RAG retriever (no global state)
- Stateless backend for scaling
- JWT auth for security

---

### SEGMENT 7: CHALLENGES & FUTURE WORK (2 minutes)

**Challenges Overcome:**
1. **Vector dimension mismatch** (FAISS index vs embedding model)
   - Resolved by standardizing embedding model across system
2. **Data leakage in multi-user environment**
   - Fixed localStorage cleanup on logout
3. **Realistic code execution** (students want to use `Scanner` for input)
   - Added optional PTY terminal service

**Future Enhancements:**
- Peer-to-peer learning (student forums moderated by AI)
- Adaptive difficulty (quiz difficulty adjusts based on performance)
- Mobile app
- Real-time collaborative coding
- Expanded to other languages (Python, C++, etc.)

---

### SEGMENT 8: CLOSING & Q&A (2-3 minutes)

**Key Takeaway:**
*"CodeTutor brings personalized AI tutoring to scale. Students learn faster with instant feedback, teachers manage classrooms more efficiently, and the platform keeps improving as it learns from interactions."*

**Call to Action / Vision:**
- *"Imagine every student having access to patient, knowledgeable AI tutoring. CodeTutor makes that possible."*

**Open for Questions** (Prof often has ~5 minutes of Q&A)

---

## COMMON Q&A RESPONSES

### Q: *"How accurate is the AI tutor?"*
**A:** "We use RAG (Retrieval-Augmented Generation) with Java official docs + our platform guide. The AI doesn't hallucinate—it only answers based on indexed content. We can test this live: [pick a question, ask on-screen]."

### Q: *"How do you handle students cheating on assignments?"*
**A:** "Practical tests have multiple generated instances and code is analyzed for plagiarism. For classroom quizzes, teachers can set time limits and review student submissions for suspicious patterns."

### Q: *"What about students who fall behind?"*
**A:** "Progress dashboard highlights weak areas. Teachers get alerts, can spend 1-on-1 time with struggling students, and AI tutor is available 24/7 for additional practice."

### Q: *"Why not just use ChatGPT?"*
**A:** "ChatGPT is great but unpredictable for learning. CodeTutor is curriculum-aware, context-aware, and scales with classrooms. Teachers control what the AI knows. Also, code execution is integrated—students run code directly without leaving the platform."

### Q: *"How do you ensure data privacy?"*
**A:** "User data is stored in PostgreSQL with password hashing. Each user session is isolated. No student data is used to train our models."

### Q: *"What's next?"*
**A:** "We're exploring adaptive difficulty, peer learning networks, and multi-language support. The vision is a universal learning platform—anywhere, anytime, personalized."

---

## BACKUP DEMO IDEAS

If live demo fails:
- Have **10-15 pre-recorded screenshots** ready (PNG files)
- Show visual walkthrough: login → topic → AI chat → quiz → challenge
- Can still explain the features verbally

---

## TIMING CONTROL TIPS

- **Running ahead?** Spend more time on Q&A or dig deeper into RAG system
- **Running late?** Skip classroom demo, keep focus on core student features
- **If tech fails:** Do a walkthrough of key screens on-screen (show source code, explain flow)

---

## PRESENTER REMINDERS

✅ **Confidence:** You know this platform deeply—let it show  
✅ **Enthusiasm:** You're solving a real problem (learning barriers)  
✅ **Clarity:** Avoid jargon; explain RAG, ML, API in plain terms  
✅ **Live vs. Recorded:** Live is more engaging, but have backups  
✅ **Audience:** Prof wants to hear what *you* learned building this  

---

## Files to Reference During Q&A

- `README.md` – quick project overview
- `java_docs/platform_guide/platform_guide.txt` – comprehensive user guide
- `rag_system.py` – RAG implementation
- `db_models.py` – data schema
- `routers/` + `services/` – API endpoints

---

## Good Luck! 🚀

You have a solid, feature-rich platform. Tell the story of *why* you built it (learning barriers), *what* it does (7 key features), and *how* it impacts students (immediate feedback, access, personalization).

Your professor will likely appreciate the balance between vision, execution, and thoughtful technical design.

# CodeTutor Demo Script – Step-by-Step

**Use this as a quick reference during **live presentation**. Read as if explaining to professor.**

---

## DEMO CHECKLIST BEFORE STARTING

- [ ] Backend running: `uvicorn main:app --reload` on port 8000
- [ ] Frontend running: `npm start` on port 3000
- [ ] Browser at: `http://localhost:3000`
- [ ] Logged out (fresh state)
- [ ] Test account prepped: email `test@test.com`, password `test1234`
- [ ] Optional: Open 2nd browser tab with `http://localhost:8000/docs` for API reference

---

## FLOW 1: LOGIN & OVERVIEW (1.5 minutes)

### Script:
"Let me log in as a student and show you the core learning experience."

### Actions:
1. **Click "Login"** or show login screen
2. **Enter:**
   - Email: `test@test.com`
   - Password: `test1234`
3. **Click "Sign In"**
4. Wait for redirect to course catalog

### What You're Showing:
- Simple, clean authentication
- No friction on entry

**Prof Perspective:** Professional onboarding

---

## FLOW 2: COURSE SELECTION (1 minute)

### Script:
"When students first enter, they choose a learning path. This is key—it's **not one-size-fits-all**. We have Basic Java for beginners and Enhanced Java for those with some experience."

### Actions:
1. **On Course Catalog page**, show two cards:
   - Basic Java (12 topics)
   - Enhanced Java (8 topics)
2. **Click "Start Learning" on Basic Java** (or choose one)

### What You're Showing:
- Intentional curriculum design
- Student agency (choose depth)
- Clear progression

**Prof Perspective:** Thoughtful pedagogy

---

## FLOW 3: ROADMAP & TOPIC SELECTION (1.5 minutes)

### Script:
"Here's the roadmap. Each circle is a topic. Blue means complete, gray means locked (prerequisites not done), and yellow means in-progress. This visual structure keeps students motivated—they see clear progress."

### Actions:
1. **Show roadmap page** — point to:
   - Colored topic circles
   - Titles under each (Variables, Loops, etc.)
2. **Click on an incomplete topic** (e.g., "Loops & Iteration")
   - **Don't click:** Topic should be available (not locked)
3. **Wait for topic detail to load**

### What You're Showing:
- Clear, scannable progress
- Structured learning path
- Visual motivation

**Prof Perspective:** Engagement design + pedagogical sequence

---

## FLOW 4: TOPIC DETAIL & AI TUTOR (3 minutes)

### Script:
"Now I'm in a topic. On the left is an overview—the learning material. On the right is the AI Tutor. Students can ask questions about this topic, and the AI will answer based on Java documentation and our curriculum. This is where personalization happens."

### Actions:
1. **Show the topic overview** (left panel)
   - Read a snippet or just point to it
   - Say: "This is our curriculum content."

2. **Click on the AI Tutor panel** (right side)
   - Should show a chat interface

3. **In the chat input, type a question:**
   - Example: `"Can you explain the for loop syntax?"`
   - OR: `"What's the difference between while and do-while?"`

4. **Send the message** (Enter or Send button)
   - Show: AI response appears (this hits the backend RAG system)
   - Read the response aloud
   - Say: "Notice it's specific to loops—not generic ChatGPT. The AI searched our Java docs and generated this answer. It's faithful to the source."

5. **Ask a follow-up** (optional):
   - Type: `"Can you give me an example?"`
   - Show: AI remembers context and answers in-thread

### What You're Showing:
- Immediate AI assistance without leaving the learning page
- Contextual, grounded answers (RAG in action)
- Conversational clarity

**Prof Perspective:** Intelligent tutoring system + technology integration

---

## FLOW 5: CODE PLAYGROUND (2 minutes)

### Script:
"Many students learn better by *doing*. The Code Playground lets them write and run Java code instantly without any setup. Let me demo that."

### Actions:
1. **Navigate to Playground** (💻 in sidebar)
   
2. **Show pre-filled code** (should be a Hello World or simple example):
   ```java
   public class Main {
       public static void main(String[] args) {
           System.out.println("Hello, World!");
       }
   }
   ```

3. **Click "Run Code"**
   - Show: Output appears instantly
   - Say: "No Java compiler on their machine needed. No IDE setup. Just write and run."

4. **Modify the code:**
   - Change the string to something fun: `"Hello, CodeTutor!"`
   - Click "Run Code" again
   - Show: New output

5. **Introduce an error (optional):**
   - Remove a semicolon
   - Click "Run Code"
   - Show: Error message
   - Say: "Students get immediate feedback on mistakes. No guessing."
   - Fix it and run again to show success

### What You're Showing:
- Low-friction code execution
- Instant feedback
- Iterative learning workflow

**Prof Perspective:** Removes barriers; enables experimentation

---

## FLOW 6: QUIZ / EXERCISES (2 minutes)

### Script:
"After learning the concept, students test themselves with quizzes. These are auto-graded, so students know instantly if they understand."

### Actions:
1. **Navigate to Exercises** (📝 in sidebar)
   
2. **Show list of available quizzes**
   - Pick one (e.g., "Variables Quiz", "Loops MCQ")

3. **Enter the quiz**
   - Show: First question with multiple choice options
   - Say: "Each question is self-contained. Student selects an answer and submits."

4. **Select an answer** and click **"Submit"** or **"Next"**
   - Show: Feedback
     - If correct: ✅ and explanation, move to next
     - If wrong: ❌ and explanation of correct answer

5. **Complete 2-3 questions** (speed through rest)

6. **Show Results Screen:**
   - Score (e.g., 85%)
   - Time taken
   - Breakdown by topic (if available)
   - Say: "This data helps us track weak areas. If a student consistently misses inheritance questions, the system flags that."

### What You're Showing:
- Auto-graded assessment
- Immediate feedback (not delayed grading)
- Learning analytics

**Prof Perspective:** Scalable assessment + data-driven interventions

---

## FLOW 7: CODING CHALLENGE (2-3 minutes)

### Script:
"For deeper practice, we have Coding Challenges. These are Java programming tasks where students write methods, and the system auto-grades against test cases. This is where passive learning becomes active skill-building."

### Actions:
1. **Navigate to Coding Challenges** (🎯 in sidebar)

2. **Show list of challenges**
   - Pick one (e.g., "Find Max in Array", "Reverse a String")

3. **Click to open a challenge**
   - Show:
     - Problem statement (goal, description)
     - Example input/output
     - Editable code area with method stub

4. **Talk through the problem:**
   - Read the requirements
   - Point out: "Student has to write the method body."

5. **Click "Run Tests"** (or provide a pre-written solution):
   - Show: Test case grid
     - Each test shows: Input → Expected → Your Output → ✅ or ❌
   - If all pass: Show success message, points awarded
   - If some fail: Show which tests failed (helps debug)

6. **Optional - Fix a failing test:**
   - Modify the code slightly
   - Run tests again
   - Show the fix works

### What You're Showing:
- Hands-on practice at scale
- Instant auto-grading (hundreds of students possible)
- Detailed feedback (which tests pass/fail, not just a grade)

**Prof Perspective:** Practical skill building + scalable assessment

---

## FLOW 8: PROGRESS DASHBOARD (1 minute, optional)

### Script:
"Here's the student's progress dashboard. They can see their learning journey—all topics, where they stand, and where they're weak."

### Actions:
1. **Navigate to Dashboard** or find progress view
   - Show: Summary of progress
   - Weak areas (e.g., "Inheritance - 40% quiz accuracy")
   - Completed topics (e.g., "Variables - 100%")

2. **Point out:**
   - Visual progress bars
   - Completion percentages
   - Flagged weak areas

### What You're Showing:
- Transparency in learning progress
- Early warning for interventions
- Motivational feedback

**Prof Perspective:** Personalized learning insights

---

## FLOW 9: CLASSROOM DEMO (Optional, 2 minutes if time)

### Script:
"If you have teachers in the class, they can create private classrooms, upload materials, and assign auto-graded quizzes. The AI tutor searches materials + Java docs, so it's curriculum-aligned."

### Actions:
1. **Navigate to Teacher Dashboard** (if available and logged in as teacher)
   - OR describe: "Teachers can create a classroom by uploading syllabus, lecture notes, etc."

2. **Show classroom view:**
   - Student enrollment
   - Uploaded materials
   - Auto-generated quizzes
   - Analytics dashboard

### What You're Showing:
- Classroom integration
- Scalable teaching tools
- Material-aware AI

**Prof Perspective:** Institutional fit

---

## BACKUP: If Live Demo Fails

### Pivot Strategy:
1. **Stay calm.** Say: "Let me quickly check the connection—meanwhile, let me walk you through the flow visually."
2. **Show UI mockups or screenshots** (you can have PNGs prepared):
   - Login screen
   - Roadmap
   - Topic detail with AI chat
   - Quiz results
   - Challenge results
3. **Explain each screen** as if live, pointing to features
4. **Offer:** "After, I can show you the live version—the network might be better in a moment."
5. **Alternatively:** Take attendees through **code walk** (show `routers/`, `rag_system.py`)

---

## TIMING FLEXIBILITY

- **Ahead of time?** 
  - Deep-dive on AI tutor chat (multiple questions)
  - Show code playground error handling
  - Classroom demo

- **Behind time?**
  - Skip optional classroom flow
  - Group quizzes + challenges flows
  - Summarize dashboard instead of showing

- **Q&A taking over?**
  - Wrap up demo early
  - Allocate time for prof's questions (they often want to dig into architecture)

---

## EXPERT TIPS FOR PRESENTING

1. **Narrate as you click:**
   - Don't stay silent; explain what's happening
   - Say what you expect before each action
   - When something appears, read it aloud

2. **Emphasize the "why," not the "what":**
   - ❌ Bad: "Here's a quiz UI with 4 buttons."
   - ✅ Good: "This auto-graded quiz gives instant feedback, so students don't wait days to know if they got it right. That immediacy keeps motivation high."

3. **Show, don't just tell:**
   - Avoid long explanations; let demo speak
   - But highlight **key educational principles** as you go

4. **Engage the professor:**
   - Make eye contact when speaking
   - Invite questions mid-demo: "Any questions about how the AI tutor works?"
   - Be ready to explain the "why" behind architectural choices

5. **Manage pace:**
   - Don't rush (they're seeing it for the first time)
   - But keep momentum (45 min is tight with 8 flows)

---

## SPEAKER NOTES: KEY PHRASES

### When demoing AI Tutor:
✅ *"This is Retrieval-Augmented Generation in action. The AI doesn't hallucinate—it only pulls from Java docs and our platform guide, so the answer is always grounded in approved sources."*

### When showing quizzes:
✅ *"Notice the instant feedback. No waiting for grading. Students know immediately if they understood, so they can adjust and retry. That's powerful for learning."*

### When showing coding challenges:
✅ *"Here's where practice becomes real. Each test case passes or fails, giving detailed feedback. A teacher can assign 100 students; the system grades all of them in seconds."*

### When showing progress:
✅ *"This dashboard is the learner's mirror. They see what they've mastered and where they need help. It's personalized visibility—that drives engagement."*

---

## QUICK REFERENCE: What Each Feature Teaches

| Feature | Learning Principle | Time in Demo |
|---------|-------------------|-------------|
| Roadmap | Structured progression, scaffolding | 1 min |
| AI Tutor | Personalized, on-demand support | 3 min |
| Playground | Low-friction experimentation | 2 min |
| Quizzes | Immediate assessment & feedback | 2 min |
| Challenges | Practical, auto-graded skill-building | 2-3 min |
| Dashboard | Transparency, early intervention | 1 min |

---

Good luck! Remember: **You're not just demoing features—you're showing how technology removes learning barriers and scales human teaching.**

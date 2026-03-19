# ☕ CodeTutor — Java Learning Platform

An AI-powered Java learning platform with RAG-based tutoring, quizzes, practical tests, and a code playground.

---

## 🚀 Getting Started

### Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload
```

Server runs at: `http://localhost:8000`  
API docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at: `http://localhost:3000`

---

## 🔐 Test Account

A pre-created dummy account for testing login and progress sync:

| Field    | Value          |
|----------|----------------|
| Email    | `test@test.com` |
| Password | `test1234`      |

> **Note:** Login is optional. Users can use the platform as a guest and their progress is saved in `localStorage`. Logging in at any time will upload the local progress to the backend without overwriting any completed items.

---

## ✨ Features

- **AI Tutor** — RAG-based Q&A with NLI faithfulness verification (97.62%)
- **Roadmap** — Visual Java learning roadmap with topic completion tracking
- **Quizzes** — AI-generated MCQ quizzes based on completed topics
- **Practical Tests** — Coding tests with automated grading and hints
- **Playground** — In-browser Java code execution
- **Progress Tracking** — Local + backend sync (login optional)

---

## 🗄️ Database

SQLite (`learning_platform.db`) is created automatically on first run.

Tables:
- `users` — registered accounts
- `user_progress` — per-user learning progress
- `quiz_attempts` — individual quiz attempt history
- `test_attempts` — individual test attempt history

To recreate the dummy account:

```bash
python -c "
import bcrypt
from database import SessionLocal
from db_models import User

db = SessionLocal()
pwd_hash = bcrypt.hashpw('test1234'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
user = User(email='test@test.com', password_hash=pwd_hash, full_name='Test User')
db.add(user)
db.commit()
print('Done!')
db.close()
"
```

---

## 📊 AI Performance Metrics

| Metric | Score |
|--------|-------|
| NLI Faithfulness | 97.62% (46/47 claims) |
| Semantic Similarity | 80.78% |
| Context Recall | 74.21% |
| Avg Response Time | 6.73s |

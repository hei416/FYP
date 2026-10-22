# Bug audit: fix Crit/High NEW findings

## Goal
Fix the Crit/High findings from `tasks/2026-10-23_bug-audit.md` (audit of
`main`) that are marked `NEW` (not already fixed on this branch). Med/Low
findings are out of scope for this pass — left in the audit file as backlog.

Base: `integration/container-readiness` (already carries the fixes the audit
marks "FIXED on branch" — don't re-do those, verify they're still present).

## Scope — findings to fix (file:line from the audit; re-verify line numbers
first, this branch has moved code around vs. main)
- S5 — `classroom.py` `/ask`: no membership check on classroom RAG query
- S6 — published challenges ship `model_solution`/`base_code` to students
- S7 — JWT verify accepts the sentinel fallback secret
- S9 — teacher role-check missing ownership (operator precedence)
- S10 — `/detailed-results`: role check only, no ownership
- S11 — PATCH classroom: guard doesn't actually gate students
- S13 — quiz score / challenge passed trusted from client
- S14 — published quiz ships `correct_index` + `explanation`
- S15 — `student-results` doesn't filter by classroom_id
- S16 — `/ask-multi`: no per-classroom membership check
- S19 — `/my-work/save` accepts arbitrary score/type, feeds analytics
- S20 — legacy upload: unsanitized `ext`, no cleanup on exception, no size cap
- C1 — `/ask-multi` uses `request.question` instead of `body.question`
- C2 — `rag_chain` tuple unpacking bug, `/classroom/{id}/ask` always 500s
- C3 — silent embedder/dim swap on error → mixed-dim vectorstore crash
- C4 — rebuild script dim mismatch vs runtime query model (latent)
- B1 — JSON list columns mutated in place → progress never persists
- B2 — `sentence-transformers` missing from requirements.txt
- B3 — `requests.post` with no timeout in HKBULLM calls

## Rules
- Never touch `backend/vectorstore/`, secrets, `.env*`.
- Never push — commit locally only, ask before any push.
- Add/extend offline tests where feasible instead of just patching.

## Done-criteria
- Each item above verified fixed by reading the actual code path (not just
  pattern-matched).
- Offline suite still green (pytest, `npm test`).
- Route count unchanged (120) unless a fix intentionally removes a route.
- Summary: what was fixed, what was found to already be fixed/stale on this
  branch, anything that turned out to need an owner decision instead.

## Status
Done, except one deliberate deferral (see below).

### Fixed
- S5 — added `_verify_classroom_access` to `/{classroom_id}/ask` (classroom.py).
- S6 — `model_solution` stripped from student-facing list/get practical-challenge
  responses (`base_code` deliberately kept — students need the starter code).
- S7 — `verify_token` now hard-refuses when `SECRET_KEY` is the sentinel
  (`UNSET_SECRET_KEY_REPLACE_ME`), matching `create_access_token`'s existing guard.
  Did not add a startup hard-fail (would complicate the offline test env, which
  sets its own SECRET_KEY) — the verify-side refusal is sufficient to close
  the forgery hole.
- S9 — `student-results` operator-precedence bug fixed: now `admin or
  (teacher AND classroom.teacher_id == caller)`.
- S10 — `/detailed-results` now uses `_verify_teacher_access` (ownership, not
  just role).
- S11 — PATCH classroom now uses `_verify_teacher_access` (previously only
  gated when `role == "teacher"`, silently skipping students entirely).
- S13 — quiz `score` is now computed server-side from `quiz.questions`
  `correct_index` + submitted `answers`, ignoring the client's `score` field.
  Challenge `passed` is now ALSO re-execution-graded (follow-up fix, same
  session): confirmed the `base_code`/`question` payload shape is reliable —
  the generator (`_generate_practical_question` in practical_tests.py) always
  emits `baseCode.class`/`baseCode.methods`/`question.expectedOutput`, this
  is what `_save_db_question` and `evaluate_ai` already key off, and the
  frontend's teacher-save flow (`TeacherClassroomDetail.js`) round-trips the
  generator's `base_code` object unedited — so a new
  `grade_challenge_submission()` helper in practical_tests.py reuses the
  existing Paiza integration (`_extract_student_methods`,
  `_extract_helper_classes`, `_build_smart_run_app`, `_run_java_via_paiza`)
  to re-run the student's submitted code server-side and compare its stdout
  to the challenge's stored `expectedOutput`. `submit_practical_challenge_attempt`
  now calls this and ignores the client's `execution_output`/`passed` claim
  entirely — the persisted `execution_output` is the server's own result.
  Verified the live frontend (`CodingChallengePlayer.js` → `classroomService.js`)
  never reads the submit response's `execution_output`/`passed` fields (it
  already computed its own pass/fail display before calling submit), and that
  the teacher/student dashboards (`TeacherClassroomDetail.js`) only read
  `attempt.passed` and `execution_output.stdout`/`.stderr`, both of which the
  new shape still provides — no frontend changes needed.
- S14 — `correct_index`/`explanation` stripped from quiz questions served to
  students (list + get).
- S15 — `/practical-challenges/{id}/student-results` now verifies the challenge
  belongs to `classroom_id` before returning results.
- S16 — `/ask-multi` now verifies per-classroom membership/ownership for every
  id in `classroom_ids` before querying.
- S19 — `/my-work/save`: `work_type` whitelisted to playground/quiz/test;
  `result_data.score` clamped to [0,100] when present. This does not derive
  the score from a real graded event (no such event exists for this
  self-report path) — see Known gaps.
- S20 — legacy `/documents` upload: extension whitelisted to `[a-z0-9]{1,10}`
  (falls back to `.bin`), streamed to a `tempfile.mkstemp` path under a
  `try/finally` so it's always removed, and capped at `MAX_UPLOAD_SIZE_BYTES`
  during the copy instead of only after the whole file is buffered.
- C1 — `/ask-multi`: `request.question` → `body.question` (was reading the
  Starlette `Request`, not the parsed body).
- C2 — `/classroom/{id}/ask` (rag.py): replaced the broken call into the
  general-KB `chain_with_fallback` (tuple-unpack bug, and it was retrieving
  from the wrong vectorstore for a classroom-scoped question) with a direct
  HKBULLM call over the already-retrieved classroom `docs`, mirroring the
  classroom.py `/ask` endpoint's prompt shape.
- C3 — HKBU→MiniLM embedder fallback no longer flips the shared embedder used
  by file ingestion (separate `_query_fallback_embedder` cache for query-time
  only); `_get_or_build_index` now detects mixed-dim stored chunks and raises
  a clear 503 instead of crashing on a ragged `np.array`; `ingest_document`
  now refuses to add chunks whose dimension doesn't match a classroom's
  existing chunks.
- C4 — `rebuild_vectorstore.py` now builds with `all-MiniLM-L6-v2` (384-dim),
  matching the model `rag_system.py` queries with at runtime (was
  `all-mpnet-base-v2`, 768-dim).
- B1 — `progress.py` (mark-topic-complete, quiz-attempt, test-attempt): list
  is now copied (`list(progress.X or [])`) before `.append()` so SQLAlchemy's
  change-tracking sees a new object and actually emits the UPDATE.
- B2 — already fixed on this branch (`sentence-transformers==2.7.0` already
  pinned in `requirements.txt`); verified, no change needed.
- B3 — added `timeout=` to all three `requests.post` calls in `models.py`
  (HKBUEmbeddings query/documents, HKBULLM) plus bounded retry
  (429/503, 3 attempts, excluding 403 per the adjacent B23 finding) on the
  LLM call, which previously had none.

### Known gaps (owner decision needed, not fixed here)
- **S19**: no stored ground truth exists for `/my-work/save` quiz/test scores
  to be graded against (unlike the classroom quiz flow fixed under S13) — the
  clamp is a bound, not a fix for self-reported completion.

### Verification
- `python -m pytest tests/test_security_fixes.py tests/test_terminal_proxy.py
  tests/test_bug_audit_crit_high.py -q` → 38 passed (ran via a sibling
  worktree's `.venv` since this worktree had none).
- `python -c "import main"` → imports cleanly, 118 routes registered per
  main.py's own startup log / 120 via `len(app.routes)` (includes the two
  framework default routes) — unchanged from the audit baseline.
- New tests added in `tests/test_bug_audit_crit_high.py` covering S13 (quiz
  score grading incl. zero-questions/missing-answers edge cases; challenge
  `passed` grading with `_run_java_via_paiza` mocked — a forged "passed: true"
  claim with real output "0" is overridden to `passed: false`, and real
  output "42" matching `expectedOutput` is correctly graded `passed: true`),
  S14 (answer key stripped for students), S11 (student PATCH rejected), S9
  (non-owner teacher rejected from student-results).
- Everything committed locally on `fix/bug-audit-crit-high`; not pushed.

# RAG evaluation — methodology and golden set

Status: **methodology + golden set only** (deploy-inert). The runner script is deliberately not committed yet — it would live under `backend/`, which matches the (provisional) backend CI filter `backend/**` and would deploy on push (the old `'**.py'` filter, audit FE-8, was removed with the 2026-10-22 restructure). Commit the runner once the deploy-method decision lands. Tracked as GAP-3 in `docs/plans/active/codebase-audit.md`.

## What is being evaluated

The global RAG pipeline (`backend/services/rag_system.py` + `backend/routers/rag.py`): MMR retrieval over two committed FAISS stores — `backend/vectorstore/java_knowledge` (corpus: `backend/java_docs/` — oracle, javanotes, w3schools, geeksforgeeks, books, data_structures, exceptions) and `backend/vectorstore/platform_guide`. Current parameters (`backend/core/config.py:79-83`): chunks 600/150, k=3, fetch_k=15, lambda_mult=0.7. Classroom RAG (`backend/services/classroom_rag.py`) is a separate pipeline — evaluate later with per-classroom fixtures.

## Metrics

1. **Retrieval hit rate (hit@k):** for each golden question, does any of the k retrieved chunks come from the expected source area (`java_docs/<area>`) and mention the expected key terms? Report hit@1 and hit@3.
2. **Answer key-point coverage:** fraction of the question's key points present in the answer (string/semantic match; human-graded on first runs).
3. **Faithfulness:** reuse the existing runtime NLI monitor (`services/nli_monitor.py`) score on (answer, retrieved context) — the production guard doubles as the offline metric. Alert threshold as configured in the monitor.
4. **Abstention on out-of-scope (OOS) questions:** the model must decline or redirect, not invent Java-flavoured answers to non-corpus questions. Score = refusal rate on the OOS subset.

A run records: date, commit, parameters (k/fetch_k/lambda/chunking), per-question results, aggregates. Store results as `docs/rag-eval-results/<YYYY-MM-DD>.md` (deploy-inert). Compare any retrieval/chunking change (e.g. GAP-2 chunker unification) against the previous run before it ships.

## Golden set v1 (20 questions)

Types: `core` (Java fundamentals), `adv` (advanced), `plat` (platform guide), `oos` (out-of-scope — must abstain). Key points are the minimum a correct answer contains.

| ID | Type | Question | Expected source area | Key points |
|---|---|---|---|---|
| G01 | core | What is the difference between `==` and `.equals()` for Strings in Java? | java_knowledge | reference vs content comparison; String pool caveat; use `.equals()` for values |
| G02 | core | How do I read an integer from the keyboard using Scanner? | java_knowledge | `import java.util.Scanner`; `new Scanner(System.in)`; `nextInt()`; closing/`nextLine()` pitfall |
| G03 | core | What does `static` mean on a method? | java_knowledge | belongs to class not instance; called without object; cannot use `this`/instance fields |
| G04 | core | Explain the difference between a `while` loop and a `do-while` loop. | java_knowledge | do-while executes body at least once; condition check order |
| G05 | core | What is the default value of an uninitialised `int` field vs a local `int` variable? | java_knowledge | field defaults to 0; local must be initialised or compile error |
| G06 | core | How do arrays differ from `ArrayList`? | java_knowledge / data_structures | fixed vs dynamic size; primitives vs objects (autoboxing); `length` vs `size()` |
| G07 | core | What is method overloading vs overriding? | java_knowledge | same name different parameters (compile time) vs subclass redefinition (runtime); `@Override` |
| G08 | core | Why do I get `NullPointerException` and how do I avoid it? | exceptions | dereferencing null; null checks / initialisation; reading the stack trace line |
| G09 | core | What is the purpose of a constructor, and what is the default constructor? | java_knowledge | initialises object; same name as class, no return type; compiler-provided no-arg default disappears once any constructor is defined |
| G10 | core | How does `String.split()` work — what does the argument mean? | java_knowledge | regex delimiter; returns `String[]`; escaping special chars like `.` |
| G11 | adv | What is the difference between checked and unchecked exceptions? | exceptions | Exception vs RuntimeException; must declare/catch checked; examples (IOException vs NPE) |
| G12 | adv | When should I use an interface instead of an abstract class? | java_knowledge | multiple implementation; no state (pre-Java-8 nuance ok); abstract class for shared code/fields |
| G13 | adv | How does a `HashMap` store and look up values? | data_structures | hashing of key; buckets/collisions; `hashCode`/`equals` contract; O(1) average lookup |
| G14 | adv | What is polymorphism in Java? Give an example. | java_knowledge | supertype reference to subtype object; dynamic dispatch; example with override |
| G15 | adv | What does the `final` keyword do on a variable, a method, and a class? | java_knowledge | constant / no reassignment; no override; no subclassing |
| G16 | plat | How do I join a classroom on this platform? | platform_guide | join/class code entered by student; teacher creates classroom and shares code |
| G17 | plat | Where can I see my quiz results and progress? | platform_guide | progress/my-work area; saved quiz and test attempts |
| G18 | oos | What is the capital of France? | — (abstain) | declines or redirects to Java/platform scope; no fabricated sources |
| G19 | oos | Write me Python code to scrape a website. | — (abstain) | states Java/platform scope; does not answer in Python as if from the corpus |
| G20 | oos | What were the exam answers for last year's COMP course? | — (abstain) | refuses; no invented content presented as retrieved |

## Pass thresholds (v1 — adjust after the first baseline run)

- hit@3 ≥ 0.85 on core+adv+plat (17 questions); hit@1 ≥ 0.6.
- Key-point coverage ≥ 0.7 average.
- NLI faithfulness above the monitor's alert threshold on ≥ 90% of answered questions.
- OOS abstention 3/3.

## Runner sketch (to be committed after AUD-2)

~80 lines: load golden set (move this table to `backend/evaluation/golden_set.json` then), call the retriever directly for hit@k, call the full chain for answers, score with `nli_monitor`, write the dated results file. Run locally in the venv — never against production. The orphan artifacts `backend/evaluation/nli_results.{csv,json}` are from an earlier uncommitted script; the new runner supersedes them.

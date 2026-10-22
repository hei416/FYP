# frontend/src — layout

Reorganized 2026-10-23 (owner-approved) from a flat ~45-file root. Parent rules: [frontend/AGENTS.md](../AGENTS.md).

## Folders

| Folder | What goes here |
|---|---|
| `pages/` | Route-level components — one per `<Route>` in `App.js` (+ their CSS, e.g. `Auth.css`) |
| `components/` | UI embedded in pages (Navbar, Compiler, DocumentViewer, AI chat, DemoTour…) |
| `services/` | Backend API clients (`classroomService`, `myWorkService`, `progressService`), `AuthContext`, `ProgressTracker` (progress logic; pairs with `progressService`) |
| `utils/` | `theme.js` (design tokens), `learningPathUtils`, `ragDocMapping`, `enhancedRagDocMapping` |
| `data/` | Topic content JSON (`topicContent.json`, `enhancedTopicContent.json`) |
| `__tests__/` | Jest tests (plus `App.test.js` at root) |

Root keeps only CRA entry files: `index.js`, `index.css`, `App.js`, `App.test.js`, `setupTests.js`, `reportWebVitals.js` — plus `TeacherClassroomDetail.js.bak` (owner-kept clutter, leave it).

## Rules

- New route component → `pages/`; shared/embedded UI → `components/`; API calls live in `services/`, not inline in components.
- No path aliases — imports are relative; a file move means rewriting its importers (verify with `npm run build` + tests, see parent AGENTS.md).
- Known dead code (unimported, kept pending owner decision — backlog): `components/Lessons.js`, `components/LessonLayout.js`, `components/ProgressAnalysisCard.js`, root `App.css`, root `logo.svg`.
- Known cycle (pre-existing): `services/progressService` ↔ `services/ProgressTracker`, and `ProgressTracker` imports subtopic ID lists from `pages/BasicJavaPage` / `pages/EnhancedJavaPage`. Works, but don't deepen it.

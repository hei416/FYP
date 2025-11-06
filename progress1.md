

---

# Progress Report – Interactive Java Learning Platform

**Date:** 2025-09-17

---

## 1. Introduction and Background

Learning to program, particularly in Java, presents significant challenges for beginners. Java’s syntax and logical structures, coupled with poor error feedback mechanisms in most environments, often frustrate new learners and slow their progress. Traditional online resources, such as W3Schools and GeeksForGeeks, offer generic tutorials and limited real-time assistance. Many explanations are highly theoretical and fail to address the learner’s individual needs, leaving gaps in conceptual understanding and practical application.

With the emergence of large language models (LLMs) like OpenAI GPT and tools leveraging Retrieval-Augmented Generation (RAG), it has become possible to provide AI-driven support in code learning, including real-time code explanation, debugging guidance, and personalized feedback. By integrating these technologies with reliable source retrieval, learners can now receive contextually relevant help that adapts to their questions and progress.

This project aims to build an **interactive Java learning platform** that leverages LLMs and RAG techniques to provide accurate code explanations, practical coding guidance, and immediate feedback. The primary goal is to help beginners better understand Java concepts while improving their ability to debug and reason about code effectively.

Compared with existing platforms, the key differentiator of this system is its adaptive AI tutor, capable of providing context-aware and personalized responses in real time.

---

## 2. Technical Development

The platform follows a modern web architecture with a clear separation between the backend (FastAPI) and frontend (React). This modular approach supports scalability, maintainability, and independent development of client and server components.

### 2.1 Backend (FastAPI)

The backend orchestrates all core logic, data management, and AI-driven functionality. Its centerpiece is a **Retrieval-Augmented Generation (RAG) pipeline** that integrates multiple LLMs to deliver pedagogically meaningful explanations and code guidance.

The tutoring workflow includes:

1. **Routing:** Queries are initially directed to the most appropriate model or retrieval mechanism, based on their content and complexity.
2. **Context Retrieval:** The system uses a **sparse encoder index with Best Fields** strategy to retrieve the most relevant information from structured lesson content and Java references. This ensures semantic relevance rather than simple keyword matching.
3. **Answer Generation:** LLMs generate structured, educational responses informed by the retrieved context.
4. **Verification and Arbitration:** Outputs from multiple models (GPT, Gemini, DeepSeek) are cross-referenced to ensure factual accuracy and consistency, producing a reliable answer for the student.

The backend also handles:

* **Database Caching:** PostgreSQL stores previously generated responses to reduce redundant LLM API calls, improving performance and lowering operational costs.
* **Code Evaluation:** Integration with the Paiza API allows student-submitted Java programs to be compiled and executed, providing immediate feedback on correctness and performance.
* **Content Delivery:** Preprocessed lessons from PDF lecture notes are stored in structured JSON format, making them efficiently retrievable and dynamically renderable on the frontend.

### 2.2 Frontend (React)

The frontend is a single-page application (SPA) with modular components that provide an interactive and engaging user experience.

Key components include:

* **Lessons Module:** Presents structured course content and supports navigation between topics.
* **Compiler Module:** Allows students to write, compile, and execute Java code directly in the browser.
* **Practical Test Module:** Provides coding exercises integrated with the backend for evaluation and feedback.
* **AI Tutor Module:** Enables conversational interaction with the RAG-powered AI, displaying questions and detailed explanations.

All frontend components communicate asynchronously with the backend via RESTful APIs, ensuring smooth, real-time interaction and feedback.

### 2.3 Content Development

The platform’s content is derived from university-level lecture notes, which are processed with `tutor.py` to extract text, segment it into logical sections, and annotate metadata. This structured JSON format allows efficient retrieval by the RAG pipeline and rendering on the frontend.

In addition, a library of practical coding exercises is maintained, with each problem accompanied by base code and reference solutions. This ensures students can apply theoretical knowledge in a hands-on manner and receive immediate feedback.

---

## 3. Challenges and Blockers

Several challenges have been encountered:

* **RAG Pipeline Performance:** Multi-LLM reasoning and verification are computationally intensive. Current infrastructure limits the processing of advanced reasoning steps and SELF-RAG reflection tokens, leaving some pipeline capabilities underutilized.
* **External Dependencies:** Reliance on APIs (Paiza and LLMs) introduces rate limits and costs, requiring careful usage and caching strategies.
* **Dataset Quality:** PDF-to-JSON conversion may introduce formatting inconsistencies or lose hierarchical context, affecting retrieval accuracy.
* **Integration Complexity:** Coordinating multiple LLMs, caching, and external services requires robust error handling and careful orchestration.

---

## 4. Next Steps

Planned actions to address these challenges include:

* **Advanced RAG Feature Integration:** Re-enable reasoning steps and SELF-RAG reflection tokens, with dedicated compute resources for processing unstructured data.
* **UI/UX Improvements:** Conduct user testing to refine navigation, accessibility, and visual design for enhanced engagement.
* **Content Expansion:** Develop a pipeline for continuous addition of lessons and practical exercises, including advanced topics, to cover a wider range of learning needs.

---

## 5. Conclusion and Reflection

The project has successfully delivered a functioning platform with lessons, a live compiler, practical tests, and an initial AI tutor. The next phase will focus on fully activating advanced RAG features, improving the user interface, and expanding content coverage. These improvements will enhance the platform’s pedagogical effectiveness, reliability, and overall user experience, positioning it as a scalable, intelligent, and adaptive Java learning tool.

---

## 6. Optional Additions

### Related Work

The platform distinguishes itself from conventional learning websites by offering context-aware, adaptive explanations rather than static tutorials. Its multi-LLM RAG pipeline provides dynamic guidance, making it more responsive to individual learner needs.

### Timeline of Milestones

| Milestone                                | Status    | Date          |
| ---------------------------------------- | --------- | ------------- |
| Backend & Frontend Setup                 | Completed | Q2 2025       |
| Core Features (Lessons, Compiler, Tests) | Completed | Early Q3 2025 |
| Initial AI Tutor (Basic RAG)             | Completed | Mid Q3 2025   |
| Advanced RAG Integration                 | Planned   | Q4 2025       |
| UI/UX Enhancements                       | Planned   | Q4 2025       |
| Content Expansion                        | Planned   | Q1 2026       |


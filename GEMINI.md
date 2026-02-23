# GEMINI.md - Project Overview

## Project Overview

This project is an **interactive Java learning platform** designed to teach Java programming to beginners. It features a web-based frontend built with **React** and a robust Python backend powered by **FastAPI**. The platform's core innovation lies in its **AI-powered tutoring system**, which leverages a sophisticated Retrieval-Augmented Generation (RAG) pipeline.

Key features include:

*   **AI-Powered Tutoring:** A RAG pipeline (integrating models like `qwen3-max` as indicated in `main.py`) provides real-time, context-aware explanations, debugging guidance, and personalized feedback. It uses a FAISS index for efficient context retrieval. The system reports high NLI Faithfulness, Semantic Similarity, and Context Recall metrics.
*   **Interactive Lessons:** Structured lessons are generated from PDF documents (located in `frontend/Lecture Notes-20250622/`) and presented in an engaging format, with processed JSON data in `lessons_raw/`.
*   **Practical Code Evaluation:** Students can submit Java code for practical problems, evaluated using external services (implied by dependencies and common platform features).
*   **Live Java Code Execution:** The platform allows for immediate compilation and execution of arbitrary Java code, offering instant feedback, handled by `routers/code_execution.py`.
*   **Syntax Checking:** Basic syntax checking for Java code helps students identify and correct errors.

The backend utilizes a PostgreSQL database (as inferred from context and usage of SQLAlchemy in `cache_utils.py` and `crud_rag.py`) primarily for caching RAG pipeline results, enhancing performance and reducing redundant API calls.

## Building and Running

### Backend (FastAPI)

1.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Set up Environment Variables:**
    Create a `.env` file in the project's root directory and add any required API keys (e.g., for AI models, Paiza API). Specific variables may include:
    ```
    # Example:
    # GENAI_API_key="your-genai-api-key"
    # PAIZA_API_KEY="your-paiza-api-key"
    ```
    *(Note: Specific `.env` requirements are inferred from general project type and context; no explicit `.env` file was found in the directory scan.)*

3.  **Database Setup:**
    The application uses a PostgreSQL database for caching. Ensure a PostgreSQL server is running. SQLAlchemy is used for database interactions (e.g., `cache_utils.py`, `crud_rag.py`). The database name and user credentials would typically be configured in a database connection file (e.g., `database.py`, though this file was not found during the scan).

4.  **Run the Application:**
    ```bash
    uvicorn main:app --reload
    ```
    The backend API will be available at `http://localhost:8000`.

### Frontend (React)

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Run the Application:**
    ```bash
    npm start
    ```
    The frontend will be available at `http://localhost:3001` and will automatically connect to the backend API.

## Development Conventions

*   **Backend:**
    *   The backend is a FastAPI application, with `main.py` serving as the main entry point.
    *   Routers for different features are organized within the `routers/` directory (e.g., `rag.py`, `code_execution.py`, `lessons.py`, `pdfs.py`, `practical_tests.py`).
    *   Core services and business logic are located in the `services/` directory (e.g., `pdf_service.py`). The RAG pipeline is managed by `rag_system.py` and integrated via `routers/rag.py`.
    *   Caching utilities are found in `cache_utils.py`.
*   **Frontend:**
    *   The frontend is a React application, likely initialized with `create-react-app` (inferred from `react-scripts` in `package.json`).
    *   Main components and application logic are located in the `src/` directory (e.g., `Lessons.js`, `Compiler.js`, `PracticalTest.js`, `AI.js`).
    *   Communication with the backend is via RESTful API calls.
*   **Content:**
    *   Raw PDF lecture notes are stored in `frontend/Lecture Notes-20250622/`.
    *   Processed JSON lesson data resides in `lessons_raw/`.
    *   Code Exercise questions and solutions are found in `practical_tests/`.
*   **AI (RAG Pipeline Details):**
    *   The RAG pipeline is primarily managed by `rag_system.py` and integrated into the FastAPI app via `routers/rag.py`.
    *   The system uses FAISS for vector storage and retrieval, as indicated by the presence of `vectorstore/index.faiss` and `vectorstore/index.pkl` and the `faiss-cpu` dependency in `requirements.txt`.
    *   Performance metrics such as NLI Faithfulness, Semantic Similarity, Context Recall, and average response time are reported in `main.py`.

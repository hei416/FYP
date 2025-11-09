# GEMINI.md - Project Overview

## Project Overview

This project is an **interactive Java learning platform** designed to teach Java programming to beginners. It features a web-based frontend built with **React** and a robust Python backend powered by **FastAPI**. The platform's core innovation lies in its **AI-powered tutoring system**, which leverages a sophisticated Retrieval-Augmented Generation (RAG) pipeline.

Key features include:

*   **AI-Powered Tutoring:** A multi-LLM RAG pipeline (integrating GPT, Gemini, DeepSeek) provides real-time, context-aware explanations, debugging guidance, and personalized feedback. It uses a sparse encoder with a "Best Fields" strategy for efficient context retrieval from lecture notes and a knowledge base.
*   **Interactive Lessons:** Structured lessons are generated from PDF documents and presented in an engaging format.
*   **Practical Code Evaluation:** Students can submit Java code for practical problems, which is evaluated for correctness using the Paiza API.
*   **Live Java Code Execution:** The platform allows for immediate compilation and execution of arbitrary Java code, offering instant feedback.
*   **Syntax Checking:** Basic syntax checking for Java code helps students identify and correct errors.

The backend utilizes a PostgreSQL database primarily for caching RAG pipeline results, enhancing performance and reducing redundant API calls to external language models.

## Building and Running

### Backend (FastAPI)

1.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Set up Environment Variables:**
    Create a `.env` file in the project's root directory and add the following API keys:
    ```
    GENAI_API_key="your-genai-hkbu-api-key"
    PAIZA_API_KEY="your-paiza-api-key"
    ```

3.  **Database Setup:**
    The application uses a PostgreSQL database. Ensure a PostgreSQL server is running. The connection string is defined in `database.py`. You may need to create the database `fypdb` and a user (e.g., `hei`) with appropriate permissions.

4.  **Run the Application:**
    ```bash
    uvicorn asking_ai:app --reload
    ```
    The backend API will be available at `http://localhost:8000`.

### Frontend (React)

1.  **Navigate to the frontend directory:**
    ```bash
    cd explain-frontend
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
    *   The backend is a FastAPI application, with `asking_ai.py` serving as the main entry point.
    *   Database models are defined in `models.py`, and the PostgreSQL database is used for caching RAG results.
    *   The `tutor.py` script is responsible for preprocessing PDF lecture notes into a structured JSON format for content delivery and RAG.
    *   API routes are organized within the `routers/` directory (e.g., `rag.py`, `code_execution.py`).
    *   Core services and business logic are located in the `services/` directory (e.g., `rag_pipeline.py`, `cache_service.py`).
*   **Frontend:**
    *   The frontend is a React application, initialized with `create-react-app`.
    *   Main components are located in the `src/` directory (e.g., `Lessons.js`, `Compiler.js`, `PracticalTest.js`, `AI.js`).
    *   Communication with the backend is via RESTful API calls.
*   **Content:**
    *   Raw PDF lecture notes are stored in `frontend/Lecture Notes-20250622/`.
    *   Processed JSON lesson data resides in `lessons_raw/`.
    *   Practical test questions and solutions are found in `practical_tests/`.
*   **AI (RAG Pipeline Details):**
    *   The RAG pipeline, implemented in `asking_ai.py` and `services/rag_pipeline.py`, follows a multi-step process: Routing, Context Retrieval (using a Sparse Encoder index with "Best Fields" hybrid query strategy), Answer Generation, Verification, and Arbitration.
    *   **Important Note:** Features like LLM-generated reasoning steps and SELF-RAG reflection tokens were part of the original BlendRAG design but have been temporarily removed from the data processing pipeline in `java8_rag.py` to improve performance. These are planned for future re-integration to create a more sophisticated tutoring agent. The current implementation uses a simplified RAG model.

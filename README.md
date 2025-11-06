
# Interactive Java Learning Platform

---

## Slide 1: Project Overview

An interactive learning platform designed to teach Java programming. It consists of a web-based frontend built with React and a Python backend powered by FastAPI.

---

## Slide 2: Key Features

- **AI-Powered Tutoring:** A sophisticated RAG pipeline using multiple LLMs (GPT, Gemini, DeepSeek) to answer student questions.
- **Interactive Lessons:** Lessons are generated from PDF documents.
- **Practical Code Evaluation:** Students can submit Java code to solve practical problems, evaluated using the Paiza API.
- **Java Code Execution:** The platform can compile and run arbitrary Java code.
- **Syntax Checking:** The system can check the syntax of Java code and highlight errors.

---

## Slide 3: Technical Architecture

- **Frontend:** React
- **Backend:** Python with FastAPI
- **Database:** PostgreSQL for caching RAG pipeline results
- **AI:** RAG pipeline with multiple LLMs
- **Code Evaluation:** Paiza API

---

## Slide 4: Getting Started - Backend

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Set up Environment Variables:**
   Create a `.env` file with:
   ```
   GENAI_API_key="your-genai-hkbu-api-key"
   PAIZA_API_KEY="your-paiza-api-key"
   ```
3. **Database Setup:**
   - Make sure you have a running PostgreSQL server.
   - Connection string is in `database.py`.
   - Create the database `fypdb` and user `hei`.
4. **Run the Application:**
   ```bash
   uvicorn asking_ai:app --reload
   ```
   - Backend will be at `http://localhost:8000`.

---

## Slide 5: Getting Started - Frontend

1. **Navigate to the frontend directory:**
   ```bash
   cd explain-frontend
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Run the Application:**
   ```bash
   npm start
   ```
   - Frontend will be at `http://localhost:3000`.

---

## Slide 6: RAG Pipeline Details

- **Data Gathering:** Collect and clean domain documents (textbooks, articles, etc.).
- **Indexing and Embeddings:** Build a single Sparse Encoder index with a "Best Fields" hybrid query strategy.
- **Dual Retrieval:** Prepare the system to accept queries for the main problem and subproblems.
- **Training Data:**
    - SELF-RAG-Style Reflection/On-Demand Retrieval Data
    - Scaffolding Dataset (CLASS Approach)
    - Conversational Dataset (CLASS Approach)
- **Model Architecture:**
    - Use a resource-efficient open-source LM (e.g., Vicuna-7B, Llama2-7B).
    - Fine-tune the model on the domain corpus.
    - Instruction-tune with synthetic datasets.
- **Inference Pipeline:**
    - **Conversation Manager:** Maintain conversation history.
    - **Adaptive Retrieval:** Decide if retrieval is necessary.
    - **Sparse Encoder Retrieval:** Retrieve top-k passages.
    - **Reflection & Critique:** Assess passage relevance and supportiveness.
    - **Tutor-Like Response:** Generate structured responses.

---

## Slide 7: Future Enhancements (Full BlendRAG Implementation)

The following features are planned for future releases to create a more sophisticated and intelligent tutoring agent.

---

## Slide 8: Future Enhancements - LLM-Generated Reasoning Steps

- **Description:** During the data-building phase, an LLM will be used to generate detailed, step-by-step reasoning for each entry in the knowledge base.
- **Purpose:** To provide the tutoring model with a deeper understanding of the material, allowing it to generate more nuanced and pedagogically sound explanations.

---

## Slide 9: Future Enhancements - SELF-RAG Style Reflection Tokens

- **Description:** The data processing pipeline will include a step to generate SELF-RAG reflection tokens (e.g., `ISREL`, `ISSUP`) to assess the relevance and supportiveness of retrieved passages.
- **Purpose:** At inference time, these tokens will allow the model to critically evaluate the information it retrieves, improving the accuracy and reliability of its responses.

---

## Slide 10: Future Enhancements - Advanced Inference-Time Pipeline

- **Description:** The full BlendRAG pipeline will utilize the `reasoning_steps` and `reflection_tokens` at inference time to make more intelligent decisions about when to retrieve information and how to use it.
- **Purpose:** To enable a more dynamic and adaptive RAG system that can perform on-demand retrieval and self-correction, leading to higher-quality interactions with the user.

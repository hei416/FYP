from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
import os
import time

# Try to import local HKBU model wrappers. If missing, attempt a LangChain OpenAI
# fallback so the app doesn't fail to import at startup with ModuleNotFoundError.
try:
    from models import HKBUEmbeddings, HKBULLM
except Exception as e:
    print(f"⚠️ Local 'models' import failed: {e}. Attempting LangChain OpenAI fallback.")
    try:
        from langchain.embeddings import OpenAIEmbeddings
        from langchain.chat_models import ChatOpenAI

        # Use LangChain OpenAI classes as a best-effort fallback. These will
        # be instantiated later using the project's config (API_KEY, BASE_URL).
        HKBUEmbeddings = OpenAIEmbeddings
        HKBULLM = ChatOpenAI
        print("ℹ️ Fallback to LangChain OpenAI classes successful.")
    except Exception as e2:
        print(f"⚠️ LangChain OpenAI fallback unavailable: {e2}. RAG cannot initialize.")
        HKBUEmbeddings = None
        HKBULLM = None
from core.config import (
    API_KEY, BASE_URL,
    FAISS_MODEL_NAME, FAISS_API_VERSION, FAISS_TEMPERATURE, FAISS_MAX_TOKENS,
    FAISS_EMBEDDING_MODEL, FAISS_EMBEDDING_API_VERSION,
    VECTORSTORE_PATH, DOCS_DIR,
    CHUNK_SIZE, CHUNK_OVERLAP,
    K_DOCUMENTS, FETCH_K, LAMBDA_MULT
)


def load_documents(docs_dir=DOCS_DIR):
    """Load all .txt documents from directory"""
    print("Loading documents...")
    all_docs = []
    
    if not os.path.exists(docs_dir):
        print(f"Documents directory not found: {docs_dir}")
        return all_docs
    
    for root, dirs, files in os.walk(docs_dir):
        for file in files:
            if file.endswith('.txt'):
                filepath = os.path.join(root, file)
                try:
                    loader = TextLoader(filepath, encoding='utf-8')
                    docs = loader.load()
                    all_docs.extend(docs)
                except Exception as e:
                    print(f"  ⚠️ Could not load {file}: {e}")
    
    print(f"Loaded {len(all_docs)} documents")
    return all_docs


def chunk_documents(docs, chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP):
    """Split documents into chunks"""
    print("✂️ Chunking documents...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = text_splitter.split_documents(docs)
    print(f"Created {len(chunks)} chunks")
    return chunks


def load_or_create_vectorstore(chunks, embeddings, vectorstore_path=VECTORSTORE_PATH):
    """Load existing vectorstore or create new one"""
    
    if os.path.exists(vectorstore_path):
        print("Loading existing vectorstore...")
        try:
            vectorstore = FAISS.load_local(
                vectorstore_path,
                embeddings,
                allow_dangerous_deserialization=True
            )
            print(f"Loaded vectorstore with {vectorstore.index.ntotal} vectors")
            return vectorstore
        except Exception as e:
            print(f"Error loading vectorstore: {e}")
            print("Creating new vectorstore...")
    
    # Create new vectorstore with batching
    print(f"Creating vectorstore from {len(chunks)} chunks...")
    batch_size = 20
    vectorstore = None
    
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i+batch_size]
        batch_num = i//batch_size + 1
        total_batches = (len(chunks) + batch_size - 1) // batch_size
        print(f"  Processing batch {batch_num}/{total_batches}...")
        
        if vectorstore is None:
            vectorstore = FAISS.from_documents(batch, embeddings)
        else:
            vectorstore.add_documents(batch)
        
        vectorstore.save_local(vectorstore_path)
        time.sleep(1)
    
    print("Vectorstore created and saved!")
    return vectorstore


def build_rag_chain(vectorstore, llm, k=K_DOCUMENTS):
    """Build RAG chain with MMR retrieval + LLM fallback"""

    retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": k,
            "fetch_k": FETCH_K,
            "lambda_mult": LAMBDA_MULT
        }
    )

    # RAG prompt — context-grounded
    rag_template = """You are a Java programming tutor. Answer ONLY using the context below.

STRICT RULES:
1. Every sentence MUST come from the context
2. If context lacks info, say EXACTLY: "My knowledge base doesn't fully cover this topic"
3. NEVER use external knowledge
4. Copy code examples EXACTLY from context
5. Keep answers under 200 words
6. Start with a direct 1-sentence definition

Context:
{context}

Question: {question}

Answer (context-only, max 200 words):"""

    # Fallback prompt — uses LLM's own knowledge
    fallback_template = """You are a Java programming tutor with broad knowledge of Java and programming languages.
The knowledge base did not have sufficient information to answer this question.
Answer using your own knowledge. Be accurate, concise, and educational.
Keep answers under 200 words.

Question: {question}

Answer:"""

    rag_prompt = PromptTemplate.from_template(rag_template)
    fallback_prompt = PromptTemplate.from_template(fallback_template)

    def format_docs(docs):
        return "\n\n".join(doc.page_content for doc in docs)

    rag_chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | rag_prompt
        | llm
        | StrOutputParser()
    )

    fallback_chain = (
        fallback_prompt
        | llm
        | StrOutputParser()
    )

    def chain_with_fallback(question: str) -> str:
        rag_response = rag_chain.invoke(question)

        if "My knowledge base doesn't fully cover" in rag_response:
            print("⚠️ RAG insufficient — falling back to LLM knowledge...")
            fallback_response = fallback_chain.invoke({"question": question})
            # Optional: tag the source
            return fallback_response + "\n\n*(Answered using general knowledge — not from the knowledge base)*"

        return rag_response

    return chain_with_fallback, retriever


def setup_rag_system(rebuild_vectorstore=False, force_delete=False):
    """Main function to set up FAISS RAG system"""
    
    print("Initializing FAISS RAG system...")
    print(f"   Model: {FAISS_MODEL_NAME}")
    print(f"   Embedding: {FAISS_EMBEDDING_MODEL}")
    
    embeddings = HKBUEmbeddings(
        api_key=API_KEY,
        base_url=BASE_URL,
        model=FAISS_EMBEDDING_MODEL,
        api_version=FAISS_EMBEDDING_API_VERSION
    )
    
    llm = HKBULLM(
        api_key=API_KEY,
        base_url=BASE_URL,
        model=FAISS_MODEL_NAME,
        api_version=FAISS_API_VERSION,
        temperature=FAISS_TEMPERATURE,
        max_tokens=FAISS_MAX_TOKENS,
    )
    print("✅ Models initialized")
    
    # Force delete if requested
    if force_delete and os.path.exists(VECTORSTORE_PATH):
        import shutil
        shutil.rmtree(VECTORSTORE_PATH)
        print("🗑️ Deleted old vectorstore")
    
    # ============================================
    # LOAD EXISTING VECTORSTORE (Priority #1)
    # ============================================
    if os.path.exists(VECTORSTORE_PATH) and not rebuild_vectorstore:
        print("Loading existing vectorstore...")
        try:
            vectorstore = FAISS.load_local(
                VECTORSTORE_PATH,
                embeddings,
                allow_dangerous_deserialization=True
            )
            # Ensure the loaded vectorstore uses the current embeddings
            # implementation (HKBUEmbeddings). Some saved vectorstores may
            # contain serialized embedding clients that call the wrong
            # OpenAI path; override to ensure we use the direct HKBU
            # deployment embeddings implementation.
            try:
                vectorstore.embedding_function = embeddings
            except Exception:
                pass
            print(f"✅ Loaded vectorstore with {vectorstore.index.ntotal} vectors")
            
            # Build chain and return immediately
            print("Building RAG chain...")
            rag_chain, retriever = build_rag_chain(vectorstore, llm, k=K_DOCUMENTS)
            
            print("✅ FAISS RAG system ready!")
            print(f"   Vectorstore: {vectorstore.index.ntotal} vectors")
            print()
            
            return rag_chain, retriever
            
        except Exception as e:
            print(f"⚠️ Error loading vectorstore: {e}")
            print("   Attempting to rebuild...")
            # Fall through to rebuild logic below
    
    # ============================================
    # REBUILD VECTORSTORE (Only if needed)
    # ============================================
    print("Building vectorstore from documents...")
    docs = load_documents()
    
    if not docs:
        raise ValueError(
            f"No documents found at {DOCS_DIR}. "
            "Please ensure:\n"
            "  1. Vectorstore exists at: {VECTORSTORE_PATH}\n"
            "  2. OR place Java documents in: {DOCS_DIR}"
        )
    
    chunks = chunk_documents(docs)
    vectorstore = load_or_create_vectorstore(chunks, embeddings)
    
    print("Building RAG chain...")
    rag_chain, retriever = build_rag_chain(vectorstore, llm, k=K_DOCUMENTS)
    
    print("✅ FAISS RAG system ready!")
    print(f"   Vectorstore: {vectorstore.index.ntotal} vectors")
    print()
    
    return rag_chain, retriever

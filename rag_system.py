from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.runnables import RunnableLambda
import os
import shutil
import time

# Try to import local HKBU model wrappers. If missing, attempt a LangChain OpenAI
# fallback so the app doesn't fail to import at startup with ModuleNotFoundError.
try:
    from models import HKBUEmbeddings, HKBULLM
except Exception as e:
    print(f"⚠️ Local 'models' import failed: {e}. Attempting LangChain OpenAI fallback.")
    try:
        from langchain_openai import AzureOpenAIEmbeddings
        from langchain.chat_models import ChatOpenAI

        print("ℹ️ Fallback to LangChain Azure-compatible classes successful.")

        def _hkbu_embeddings_factory(api_key=None, base_url=None, model=None, api_version=None, **kwargs):
            endpoint = (base_url or "").rstrip('/')
            if endpoint.endswith('/api/v0/rest'):
                endpoint = endpoint[: -len('/api/v0/rest')]
            if endpoint.endswith('/openai'):
                endpoint = endpoint[: -len('/openai')]
            return AzureOpenAIEmbeddings(
                azure_deployment=model,
                azure_endpoint=endpoint,
                api_key=api_key,
                api_version=api_version,
                **kwargs,
            )

        def _hkbu_llm_factory(api_key=None, base_url=None, model=None, api_version=None, temperature=None, max_tokens=None, **kwargs):
            endpoint = (base_url or "").rstrip('/')
            if endpoint.endswith('/api/v0/rest'):
                endpoint = endpoint[: -len('/api/v0/rest')]
            if endpoint.endswith('/openai'):
                endpoint = endpoint[: -len('/openai')]
            return ChatOpenAI(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                openai_api_key=api_key,
                openai_api_base=endpoint,
                **kwargs,
            )

        HKBUEmbeddings = _hkbu_embeddings_factory
        HKBULLM = _hkbu_llm_factory
    except Exception as e2:
        print(f"⚠️ LangChain OpenAI fallback unavailable: {e2}. RAG cannot initialize.")
        HKBUEmbeddings = None
        HKBULLM = None

from core.config import (
    API_KEY,
    BASE_URL,
    DOCS_JAVA_DIR,
    DOCS_PLATFORM_DIR,
    FAISS_API_VERSION,
    FAISS_EMBEDDING_API_VERSION,
    FAISS_EMBEDDING_MODEL,
    FAISS_MAX_TOKENS,
    FAISS_MODEL_NAME,
    FAISS_TEMPERATURE,
    FETCH_K,
    K_DOCUMENTS,
    LAMBDA_MULT,
    LEGACY_VECTORSTORE_PATH,
    VECTORSTORE_JAVA_PATH,
    VECTORSTORE_PLATFORM_PATH,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
)


PLATFORM_QUERY_KEYWORDS = {
    "codetutor",
    "platform",
    "roadmap",
    "ask ai",
    "ai tutor",
    "playground",
    "quiz",
    "quizzes",
    "practical test",
    "practical tests",
    "coding challenge",
    "coding challenges",
    "my work",
    "conversation history",
    "classroom",
    "classrooms",
    "teacher dashboard",
    "admin dashboard",
    "join code",
    "class code",
    "mark as complete",
    "start tour",
    "progress",
    "sidebar",
    "navigation",
    "login",
    "logout",
    "register",
    "account",
}


def load_faiss_with_forced_embeddings(path: str, embeddings) -> FAISS:
    """Load FAISS but force our embeddings by reclassifying the loaded object."""

    class PatchedFAISS(FAISS):
        def _embed_query(self, text: str) -> list:
            return embeddings.embed_query(text)

    vs = FAISS.load_local(path, embeddings, allow_dangerous_deserialization=True)
    vs.__class__ = PatchedFAISS
    return vs


def is_vectorstore_ready(vectorstore_path: str) -> bool:
    return os.path.exists(os.path.join(vectorstore_path, "index.faiss")) and os.path.exists(
        os.path.join(vectorstore_path, "index.pkl")
    )


def load_documents(docs_dir):
    """Load all .txt documents from a directory tree."""
    print(f"Loading documents from {docs_dir}...")
    all_docs = []

    if not os.path.exists(docs_dir):
        print(f"Documents directory not found: {docs_dir}")
        return all_docs

    for root, _, files in os.walk(docs_dir):
        for file in files:
            if file.endswith('.txt'):
                filepath = os.path.join(root, file)
                try:
                    loader = TextLoader(filepath, encoding='utf-8')
                    docs = loader.load()
                    all_docs.extend(docs)
                except Exception as e:
                    print(f"  ⚠️ Could not load {file}: {e}")

    print(f"Loaded {len(all_docs)} documents from {docs_dir}")
    return all_docs


def chunk_documents(docs, chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP):
    """Split documents into chunks."""
    print("✂️ Chunking documents...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""],
    )
    chunks = text_splitter.split_documents(docs)
    print(f"Created {len(chunks)} chunks")
    return chunks


def tag_documents(docs, knowledge_base_name):
    for doc in docs:
        if not getattr(doc, "metadata", None):
            doc.metadata = {}
        doc.metadata["knowledge_base"] = knowledge_base_name
    return docs


def load_or_create_vectorstore(chunks, embeddings, vectorstore_path):
    """Load an existing vectorstore or create a new one."""
    if is_vectorstore_ready(vectorstore_path):
        print(f"Loading existing vectorstore from {vectorstore_path}...")
        try:
            vectorstore = load_faiss_with_forced_embeddings(vectorstore_path, embeddings)
            print(f"Loaded vectorstore with {vectorstore.index.ntotal} vectors")
            return vectorstore
        except Exception as e:
            print(f"Error loading vectorstore: {e}")
            print("Creating new vectorstore...")

    print(f"Creating vectorstore from {len(chunks)} chunks...")
    batch_size = 20
    vectorstore = None
    os.makedirs(vectorstore_path, exist_ok=True)

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(chunks) + batch_size - 1) // batch_size
        print(f"  Processing batch {batch_num}/{total_batches}...")

        if vectorstore is None:
            vectorstore = FAISS.from_documents(batch, embeddings)
            try:
                vectorstore.embedding_function = embeddings
            except Exception:
                try:
                    vectorstore._embedding_function = embeddings
                except Exception:
                    pass
        else:
            vectorstore.add_documents(batch)
            try:
                vectorstore.embedding_function = embeddings
            except Exception:
                try:
                    vectorstore._embedding_function = embeddings
                except Exception:
                    pass

        vectorstore.save_local(vectorstore_path)
        time.sleep(1)

    print(f"Vectorstore created and saved at {vectorstore_path}!")
    try:
        vectorstore.embedding_function = embeddings
    except Exception:
        try:
            vectorstore._embedding_function = embeddings
        except Exception:
            pass
    return vectorstore


def prepare_named_vectorstore(name, docs_dir, vectorstore_path, embeddings, rebuild=False, force_delete=False):
    """Load or build a single named vectorstore. Returns None when the store is absent."""
    print(f"Preparing {name} vectorstore...")

    if force_delete and os.path.exists(vectorstore_path):
        shutil.rmtree(vectorstore_path)
        print(f"🗑️ Deleted old {name} vectorstore at {vectorstore_path}")

    if is_vectorstore_ready(vectorstore_path) and not rebuild:
        try:
            vectorstore = load_faiss_with_forced_embeddings(vectorstore_path, embeddings)
            annotate_vectorstore_docs(vectorstore, name)
            print(f"✅ Loaded {name} vectorstore with {vectorstore.index.ntotal} vectors")
            return vectorstore
        except Exception as e:
            print(f"⚠️ Error loading {name} vectorstore: {e}")
            print(f"   Attempting to rebuild {name}...")

    docs = load_documents(docs_dir)
    if not docs:
        print(f"⚠️ No source documents found for {name} at {docs_dir}")
        return None

    docs = tag_documents(docs, name)
    chunks = chunk_documents(docs)
    vectorstore = load_or_create_vectorstore(chunks, embeddings, vectorstore_path)
    annotate_vectorstore_docs(vectorstore, name)
    print(f"✅ Built {name} vectorstore with {vectorstore.index.ntotal} vectors")
    return vectorstore


def annotate_vectorstore_docs(vectorstore, knowledge_base_name):
    docstore = getattr(vectorstore, "docstore", None)
    doc_dict = getattr(docstore, "_dict", None)
    if not isinstance(doc_dict, dict):
        return

    for doc in doc_dict.values():
        if hasattr(doc, "metadata"):
            doc.metadata = doc.metadata or {}
            doc.metadata["knowledge_base"] = knowledge_base_name


def is_platform_query(query: str) -> bool:
    lowered = query.lower()
    keyword_hits = sum(1 for keyword in PLATFORM_QUERY_KEYWORDS if keyword in lowered)
    helper_phrases = ("how do i", "where is", "where can i", "how can i", "what is", "show me", "how to")

    if keyword_hits >= 2:
        return True

    if keyword_hits == 1 and any(token in lowered for token in helper_phrases):
        return True

    return False


def deduplicate_docs(docs):
    deduped = []
    seen = set()

    for doc in docs:
        source = ""
        page_content = getattr(doc, "page_content", "")
        metadata = getattr(doc, "metadata", {}) or {}
        source = metadata.get("source", "")
        key = (source, page_content)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(doc)

    return deduped


class RoutedRetriever:
    def __init__(self, java_vectorstore=None, platform_vectorstore=None, k=K_DOCUMENTS):
        self.k = k
        self.java_retriever = self._build_retriever(java_vectorstore)
        self.platform_retriever = self._build_retriever(platform_vectorstore)

    def _build_retriever(self, vectorstore):
        if vectorstore is None:
            return None
        return vectorstore.as_retriever(
            search_type="mmr",
            search_kwargs={"k": self.k, "fetch_k": FETCH_K, "lambda_mult": LAMBDA_MULT},
        )

    def _invoke(self, retriever, query):
        if retriever is None:
            return []
        docs = retriever.invoke(query)
        return docs if isinstance(docs, list) else list(docs)

    def invoke(self, query: str):
        prefer_platform = is_platform_query(query)

        if prefer_platform:
            primary_docs = self._invoke(self.platform_retriever, query)
            secondary_docs = self._invoke(self.java_retriever, query)
            route = "platform-first"
        else:
            primary_docs = self._invoke(self.java_retriever, query)
            secondary_docs = self._invoke(self.platform_retriever, query)
            route = "java-first"

        combined = deduplicate_docs(primary_docs + secondary_docs)
        selected = combined[:self.k]
        print(f"🔀 Routed retrieval: {route} for query '{query[:80]}' -> {len(selected)} docs")
        return selected

    def get_relevant_documents(self, query: str):
        return self.invoke(query)


def build_rag_chain(retriever, llm):
    """Build RAG chain with routed retrieval + LLM fallback."""

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
        {"context": RunnableLambda(retriever.invoke) | format_docs, "question": RunnablePassthrough()}
        | rag_prompt
        | llm
        | StrOutputParser()
    )

    fallback_chain = fallback_prompt | llm | StrOutputParser()

    def chain_with_fallback(question: str) -> str:
        rag_response = rag_chain.invoke(question)

        if "My knowledge base doesn't fully cover" in rag_response:
            print("⚠️ RAG insufficient — falling back to LLM knowledge...")
            fallback_response = fallback_chain.invoke({"question": question})
            return fallback_response + "\n\n*(Answered using general knowledge — not from the knowledge base)*"

        return rag_response

    return chain_with_fallback, retriever


def setup_rag_system(
    rebuild_vectorstore=False,
    force_delete=False,
    rebuild_java=False,
    rebuild_platform=False,
    force_delete_java=False,
    force_delete_platform=False,
):
    """Main function to set up the FAISS RAG system with split-store support."""
    print("Initializing FAISS RAG system...")
    print(f"   Model: {FAISS_MODEL_NAME}")
    print(f"   Embedding: {FAISS_EMBEDDING_MODEL}")

    embeddings = HKBUEmbeddings(
        api_key=API_KEY,
        base_url=BASE_URL,
        model=FAISS_EMBEDDING_MODEL,
        api_version=FAISS_EMBEDDING_API_VERSION,
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

    rebuild_java = rebuild_java or rebuild_vectorstore
    rebuild_platform = rebuild_platform or rebuild_vectorstore
    force_delete_java = force_delete_java or force_delete
    force_delete_platform = force_delete_platform or force_delete

    java_vectorstore = prepare_named_vectorstore(
        name="java_knowledge",
        docs_dir=DOCS_JAVA_DIR,
        vectorstore_path=VECTORSTORE_JAVA_PATH,
        embeddings=embeddings,
        rebuild=rebuild_java,
        force_delete=force_delete_java,
    )
    platform_vectorstore = prepare_named_vectorstore(
        name="platform_guide",
        docs_dir=DOCS_PLATFORM_DIR,
        vectorstore_path=VECTORSTORE_PLATFORM_PATH,
        embeddings=embeddings,
        rebuild=rebuild_platform,
        force_delete=force_delete_platform,
    )

    active_vectorstores = [vectorstore for vectorstore in (java_vectorstore, platform_vectorstore) if vectorstore is not None]

    if not active_vectorstores and is_vectorstore_ready(LEGACY_VECTORSTORE_PATH):
        print("Loading legacy unified vectorstore as fallback...")
        legacy_vectorstore = load_faiss_with_forced_embeddings(LEGACY_VECTORSTORE_PATH, embeddings)
        annotate_vectorstore_docs(legacy_vectorstore, "legacy")
        retriever = legacy_vectorstore.as_retriever(
            search_type="mmr",
            search_kwargs={"k": K_DOCUMENTS, "fetch_k": FETCH_K, "lambda_mult": LAMBDA_MULT},
        )
        print(f"✅ Loaded legacy vectorstore with {legacy_vectorstore.index.ntotal} vectors")
    else:
        retriever = RoutedRetriever(
            java_vectorstore=java_vectorstore,
            platform_vectorstore=platform_vectorstore,
            k=K_DOCUMENTS,
        )

    if not active_vectorstores:
        raise ValueError(
            f"No documents found in split knowledge-base folders ({DOCS_JAVA_DIR}, {DOCS_PLATFORM_DIR}) "
            f"and no legacy vectorstore found at {LEGACY_VECTORSTORE_PATH}."
        )

    print("Building RAG chain...")
    rag_chain, retriever = build_rag_chain(retriever, llm)

    print("✅ FAISS RAG system ready!")
    print(f"   Active vectorstores: {len(active_vectorstores)}")
    print(f"   Retrieval mode: {'legacy-unified' if len(active_vectorstores) == 1 and java_vectorstore is None and platform_vectorstore is None else 'routed-split'}")
    print()

    return rag_chain, retriever
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.runnables import RunnableLambda
from langchain_core.embeddings import Embeddings
from sentence_transformers import SentenceTransformer
from typing import List
import os
import shutil
import time

# LocalEmbeddings: LangChain-compatible wrapper for offline sentence-transformers
class LocalEmbeddings(Embeddings):
    """LangChain-compatible embedding wrapper using sentence-transformers."""
    def __init__(self, model_name: str = 'all-mpnet-base-v2'):
        self._model = SentenceTransformer(model_name)
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return self._model.encode(texts, convert_to_numpy=True).tolist()
    
    def embed_query(self, text: str) -> List[float]:
        return self._model.encode(text, convert_to_numpy=True).tolist()

# ============================================================================
# LLM INITIALIZATION: HKBU qwen3-max (Primary)
# ============================================================================
# 
# Resilience Architecture:
#   Primary:   HKBU qwen3-max (via models.py → HKBULLM factory)
#              - Free university API
#              - 97% accuracy
#              - Endpoint: https://genai.hkbu.edu.hk/api/v0/rest
#
#   Fallback:  Retrieval-only mode (in routers/rag.py)
#              - Returns documents + graceful message
#              - Cost: $0
#              - Always safe (documents are accurate)
#
#   NO OpenAI: Removed (requires paid API account - not sustainable)
#   NO GPU:    See local_llm_fallback.py for CPU-only Ollama (future option)
#
# For embeddings: LocalEmbeddings (offline, consistent with vectorstore rebuild)
# ============================================================================

try:
    from models import HKBULLM
    print("✅ HKBU LLM (qwen3-max) imported successfully - Primary LLM ready")
except Exception as e:
    print(f"⚠️ HKBU LLM import failed: {e}")
    print(f"   RAG system will gracefully degrade to retrieval-only mode")
    print(f"   For local Llama 2 CPU-only fallback (future), see: local_llm_fallback.py")
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
        
        def _embed_documents(self, texts):
            return embeddings.embed_documents(texts)

    vs = FAISS.load_local(path, embeddings, allow_dangerous_deserialization=True)
    vs.__class__ = PatchedFAISS
    return vs


def is_vectorstore_ready(vectorstore_path: str) -> bool:
    return os.path.exists(os.path.join(vectorstore_path, "index.faiss")) and os.path.exists(
        os.path.join(vectorstore_path, "index.pkl")
    )


def load_documents(docs_dir):
    """Load all .txt documents from a directory tree.
    
    Recursively walks docs_dir and loads all .txt files using TextLoader.
    Skips files that fail to load, logging warnings for troubleshooting.
    
    Args:
        docs_dir (str): Root directory to search for .txt files.
    
    Returns:
        list: List of LangChain Document objects; empty list if dir not found or no .txt files.
    """
    print(f"Loading documents from {docs_dir}...")
    all_docs = []

    # Check if directory exists to avoid silent failures
    if not os.path.exists(docs_dir):
        print(f"Documents directory not found: {docs_dir}")
        return all_docs

    # Walk directory tree and load all .txt files
    for root, _, files in os.walk(docs_dir):
        for file in files:
            if file.endswith('.txt'):
                filepath = os.path.join(root, file)
                try:
                    loader = TextLoader(filepath, encoding='utf-8')
                    docs = loader.load()
                    all_docs.extend(docs)
                except Exception as e:
                    # Log problematic files but continue loading others
                    print(f"  ⚠️ Could not load {file}: {e}")

    print(f"Loaded {len(all_docs)} documents from {docs_dir}")
    return all_docs


def chunk_documents(docs, chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP):
    """Split documents into smaller chunks for vectorstore embedding.
    
    Uses RecursiveCharacterTextSplitter with semantic-aware separators:
    tries double newlines first, then single newlines, then spaces, then characters.
    This preserves logical boundaries (paragraphs > lines > words > characters).
    
    Args:
        docs (list): List of LangChain Document objects to chunk.
        chunk_size (int): Target size of each chunk (tokens/characters).
        chunk_overlap (int): Overlap between chunks to preserve context.
    
    Returns:
        list: List of chunked LangChain Document objects.
    """
    print("✂️ Chunking documents...")
    # RecursiveCharacterTextSplitter tries each separator in order to break text logically
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""],  # Prefer paragraph > line > word > character splits
    )
    chunks = text_splitter.split_documents(docs)
    print(f"Created {len(chunks)} chunks")
    return chunks


def tag_documents(docs, knowledge_base_name):
    """Add knowledge base metadata tag to all documents.
    
    Tags documents with their source knowledge base (e.g., 'java_knowledge', 'platform_guide').
    Enables the RoutedRetriever to track and prioritize documents by source.
    
    Args:
        docs (list): List of LangChain Document objects to tag.
        knowledge_base_name (str): Name of the knowledge base (used for retrieval routing).
    
    Returns:
        list: Same documents with metadata["knowledge_base"] set.
    """
    for doc in docs:
        # Initialize metadata dict if not present
        if not getattr(doc, "metadata", None):
            doc.metadata = {}
        # Tag document with its knowledge base source for routing logic
        doc.metadata["knowledge_base"] = knowledge_base_name
    return docs


def load_or_create_vectorstore(chunks, embeddings, vectorstore_path):
    """Load an existing vectorstore or create a new one. Supports resume from checkpoint.
    
    Processes chunks in batches (20 at a time) and saves progress to enable resumption
    after interruptions. Merges batches incrementally to manage memory during large builds.
    
    Args:
        chunks (list): List of document chunks to embed and index.
        embeddings: LangChain Embeddings object (LocalEmbeddings or compatible).
        vectorstore_path (str): Directory path to store FAISS index files.
    
    Returns:
        FAISS: Vectorstore object with all chunks indexed and searchable.
    """
    import json as _json
    batch_size = 20
    total_batches = (len(chunks) + batch_size - 1) // batch_size
    progress_file = os.path.join(vectorstore_path, "_build_progress.json")
    os.makedirs(vectorstore_path, exist_ok=True)

    # Check for partial build checkpoint to enable resumption
    start_batch = 0
    vectorstore = None
    if is_vectorstore_ready(vectorstore_path) and os.path.exists(progress_file):
        # Resume from checkpoint: load progress and existing vectors
        with open(progress_file) as _f:
            _prog = _json.load(_f)
        start_batch = _prog.get("batches_completed", 0)
        if start_batch >= total_batches:
            print(f"Vectorstore already complete ({start_batch}/{total_batches} batches). Loading...")
            return load_faiss_with_forced_embeddings(vectorstore_path, embeddings)
        vectorstore = load_faiss_with_forced_embeddings(vectorstore_path, embeddings)
        print(f"Resuming from batch {start_batch + 1}/{total_batches} ({vectorstore.index.ntotal} vectors so far)...")
    elif is_vectorstore_ready(vectorstore_path):
        # Vectorstore exists but no progress file — assume it's complete and just load it
        print(f"Loading existing vectorstore from {vectorstore_path}...")
        try:
            vectorstore = load_faiss_with_forced_embeddings(vectorstore_path, embeddings)
            print(f"Loaded vectorstore with {vectorstore.index.ntotal} vectors")
            return vectorstore
        except Exception as e:
            print(f"Error loading vectorstore: {e}. Rebuilding from scratch...")

    if start_batch == 0:
        print(f"Creating vectorstore from {len(chunks)} chunks...")

    # Process chunks in batches; merge incrementally to manage memory
    for i in range(start_batch * batch_size, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        batch_num = i // batch_size + 1
        print(f"  Processing batch {batch_num}/{total_batches}...")

        # Create FAISS index for this batch, then merge into main vectorstore
        batch_store = FAISS.from_documents(batch, embeddings)
        if vectorstore is None:
            vectorstore = batch_store
        else:
            vectorstore.merge_from(batch_store)

        # Persist progress after each batch to enable resumption
        vectorstore.save_local(vectorstore_path)
        with open(progress_file, "w") as _f:
            _json.dump({"batches_completed": batch_num}, _f)
        time.sleep(3)  # Brief pause to avoid overwhelming system

    print(f"Vectorstore created and saved at {vectorstore_path}!")
    return vectorstore


def prepare_named_vectorstore(name, docs_dir, vectorstore_path, embeddings, rebuild=False, force_delete=False):
    """Load or build a single named vectorstore (e.g., 'java_knowledge' or 'platform_guide').
    
    Orchestrates the full pipeline: load documents → chunk → embed → index.
    Tries to load existing vectorstore unless rebuild=True; falls back to rebuilding on error.
    Adds knowledge_base metadata to enable routing logic.
    
    Args:
        name (str): Name of vectorstore (used in metadata and logging).
        docs_dir (str): Directory containing source .txt documents.
        vectorstore_path (str): Directory to save/load FAISS index.
        embeddings: LocalEmbeddings or compatible LangChain Embeddings object.
        rebuild (bool): If True, skip loading and rebuild from source documents.
        force_delete (bool): If True, delete existing vectorstore before rebuilding.
    
    Returns:
        FAISS or None: Loaded/built vectorstore, or None if no documents found.
    """
    print(f"Preparing {name} vectorstore...")

    # Optionally delete old vectorstore to force fresh build
    if force_delete and os.path.exists(vectorstore_path):
        shutil.rmtree(vectorstore_path)
        print(f"🗑️ Deleted old {name} vectorstore at {vectorstore_path}")

    # Try to load existing vectorstore unless rebuild requested
    if is_vectorstore_ready(vectorstore_path) and not rebuild:
        try:
            vectorstore = load_faiss_with_forced_embeddings(vectorstore_path, embeddings)
            annotate_vectorstore_docs(vectorstore, name)
            print(f"✅ Loaded {name} vectorstore with {vectorstore.index.ntotal} vectors")
            return vectorstore
        except Exception as e:
            # If loading fails, fall back to rebuilding from source
            print(f"⚠️ Error loading {name} vectorstore: {e}")
            print(f"   Attempting to rebuild {name}...")

    # Load source documents; return None if directory empty or missing
    docs = load_documents(docs_dir)
    if not docs:
        print(f"⚠️ No source documents found for {name} at {docs_dir}")
        return None

    # Build vectorstore: tag → chunk → embed → index
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
    """Retriever that routes queries to appropriate vectorstore (java_knowledge or platform_guide).
    
    Analyzes query keywords to decide which knowledge base is most relevant.
    Platform queries (e.g., 'how do I join a classroom?') are routed to platform_guide first.
    Java/coding queries default to java_knowledge first. Results from both are deduplicated
    and merged, ensuring comprehensive coverage when applicable.
    
    Attributes:
        k (int): Number of documents to return per query.
        java_retriever: MMR retriever for java_knowledge vectorstore.
        platform_retriever: MMR retriever for platform_guide vectorstore.
    """
    def __init__(self, java_vectorstore=None, platform_vectorstore=None, k=K_DOCUMENTS):
        """Initialize routed retrievers from two vectorstores.
        
        Args:
            java_vectorstore (FAISS): Vectorstore of Java/programming knowledge (optional).
            platform_vectorstore (FAISS): Vectorstore of platform usage guide (optional).
            k (int): Number of top documents to return from combined results.
        """
        self.k = k
        self.java_retriever = self._build_retriever(java_vectorstore)
        self.platform_retriever = self._build_retriever(platform_vectorstore)

    def _build_retriever(self, vectorstore):
        """Create MMR (Maximal Marginal Relevance) retriever from vectorstore.
        
        MMR balances relevance with diversity by penalizing redundant results.
        
        Args:
            vectorstore (FAISS): Vectorstore to convert to retriever.
        
        Returns:
            Retriever or None: MMR retriever if vectorstore provided, else None.
        """
        if vectorstore is None:
            return None
        # MMR search_type balances relevance + diversity; fetch_k seeds the search space
        return vectorstore.as_retriever(
            search_type="mmr",
            search_kwargs={"k": self.k, "fetch_k": FETCH_K, "lambda_mult": LAMBDA_MULT},
        )

    def _invoke(self, retriever, query):
        """Safely invoke a retriever, handling None cases.
        
        Args:
            retriever: LangChain retriever or None.
            query (str): Search query.
        
        Returns:
            list: Retrieved documents, or empty list if retriever is None.
        """
        if retriever is None:
            return []
        docs = retriever.invoke(query)
        return docs if isinstance(docs, list) else list(docs)

    def invoke(self, query: str):
        """Route query to primary vectorstore and supplement with secondary results.
        
        Uses is_platform_query() to decide primary retriever. Combines and deduplicates
        results from both retrievers to maximize coverage and relevance.
        
        Args:
            query (str): User query to route and retrieve for.
        
        Returns:
            list: Up to k most relevant documents, deduplicated and ordered.
        """
        # Determine if query is about platform usage or Java/coding
        prefer_platform = is_platform_query(query)

        # Route: platform queries go to platform_guide first, then supplement with java_knowledge
        if prefer_platform:
            primary_docs = self._invoke(self.platform_retriever, query)
            secondary_docs = self._invoke(self.java_retriever, query)
            route = "platform-first"
        else:
            # Java/coding queries go to java_knowledge first, then supplement with platform_guide
            primary_docs = self._invoke(self.java_retriever, query)
            secondary_docs = self._invoke(self.platform_retriever, query)
            route = "java-first"

        # Merge and deduplicate results (by source + content) before selecting top k
        combined = deduplicate_docs(primary_docs + secondary_docs)
        selected = combined[:self.k]
        print(f"🔀 Routed retrieval: {route} for query '{query[:80]}' -> {len(selected)} docs")
        return selected

    def get_relevant_documents(self, query: str):
        """LangChain-compatible interface for retrieval (calls invoke()).
        
        Args:
            query (str): User query.
        
        Returns:
            list: Retrieved documents.
        """
        return self.invoke(query)


def build_rag_chain(retriever, llm):
    """Build RAG chain with context-only primary response and LLM fallback.
    
    Creates two parallel chains:
      1. RAG chain: retrieves documents, formats them as context, and instructs LLM to answer ONLY from context.
      2. Fallback chain: used when RAG chain indicates insufficient context (keyword detection).
    
    The returned chain_with_fallback() checks if RAG response contains the marker phrase
    'My knowledge base doesn't fully cover', and if so, invokes the fallback chain
    to provide a general knowledge answer with a disclaimer.
    
    Args:
        retriever: LangChain retriever (RoutedRetriever or FAISS retriever).
        llm: LangChain LLM (HKBULLM or ChatOpenAI).
    
    Returns:
        tuple: (chain_with_fallback function, retriever) — the callable RAG chain and its retriever.
    """

    # RAG prompt: instructs LLM to answer ONLY from retrieved context
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

    # Fallback prompt: used when RAG context is insufficient; allows general knowledge
    fallback_template = """You are a Java programming tutor with broad knowledge of Java and programming languages.
The knowledge base did not have sufficient information to answer this question.
Answer using your own knowledge. Be accurate, concise, and educational.
Keep answers under 200 words.

Question: {question}

Answer:"""

    rag_prompt = PromptTemplate.from_template(rag_template)
    fallback_prompt = PromptTemplate.from_template(fallback_template)

    def format_docs(docs):
        """Join retrieved documents with double newlines for readability in context."""
        return "\n\n".join(doc.page_content for doc in docs)

    # Build LangChain RAG pipeline: retriever → formatter → prompt → llm → parser
    rag_chain = (
        {"context": RunnableLambda(retriever.invoke) | format_docs, "question": RunnablePassthrough()}
        | rag_prompt
        | llm
        | StrOutputParser()
    )

    # Fallback chain: prompt → llm → parser (no retrieval)
    fallback_chain = fallback_prompt | llm | StrOutputParser()

    def chain_with_fallback(question: str) -> str:
        """Execute RAG chain; fall back to general LLM if context insufficient.
        
        Checks for marker phrase to detect when LLM indicates insufficient context.
        This is more robust than checking for empty retrieval results, as some queries
        may retrieve documents that are tangentially relevant but unhelpful.
        
        Args:
            question (str): User question to answer.
        
        Returns:
            str: Answer from RAG or fallback chain, with disclaimer if from fallback.
        """
        # First attempt: RAG chain with context-only constraint
        rag_response = rag_chain.invoke(question)

        # Detect if LLM signaled insufficient knowledge and switch to fallback
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
    """Main orchestrator: Initialize FAISS-based RAG system with resilience architecture.
    
    =========================================================================
    RESILIENCE ARCHITECTURE
    =========================================================================
    
    Primary LLM:
      - HKBU qwen3-max (97% accuracy, free university API)
      - If this fails → System gracefully degrades
    
    Fallback (in routers/rag.py):
      - Retrieval-only mode: Returns documents + helpful message
      - Cost: $0
      - Quality: Safe (documents always accurate)
      - User experience: Still helpful, no cryptic errors
    
    Future Enhancement (see local_llm_fallback.py):
      - Local Llama 2 7B (CPU-only, no GPU required)
      - Not implemented for FYP (disabled by default)
      - Option: Can activate after presentation for additional resilience
    
    =========================================================================
    SETUP STEPS
    =========================================================================
    
    This function sets up the complete FAISS-based RAG pipeline:
      1. Initialize LocalEmbeddings (offline 768-dim sentence-transformers)
      2. Initialize HKBU LLM for text generation
      3. Load or build two named vectorstores: java_knowledge and platform_guide
      4. Create RoutedRetriever to intelligently route queries to appropriate store(s)
      5. Build RAG chain with fallback logic
    
    Falls back to legacy unified vectorstore if neither split store is available.
    Raises ValueError if no knowledge base is found.
    
    Args:
        rebuild_vectorstore (bool): If True, rebuild both java and platform stores
        force_delete (bool): If True, delete and rebuild both stores from scratch
        rebuild_java (bool): If True, rebuild only java_knowledge store
        rebuild_platform (bool): If True, rebuild only platform_guide store
        force_delete_java (bool): If True, delete and rebuild only java_knowledge
        force_delete_platform (bool): If True, delete and rebuild only platform_guide
    
    Returns:
        tuple: (rag_chain function, retriever) — callable RAG pipeline and its retriever
    
    Raises:
        ValueError: If no documents found in any knowledge base or legacy vectorstore
    """
    print("Initializing FAISS RAG system...")
    print(f"   LLM Model: {FAISS_MODEL_NAME}")
    print(f"   Embedding Model: sentence-transformers/all-mpnet-base-v2 (768-dim, offline)")

    # Initialize embeddings: LocalEmbeddings ensures consistent 768-dim embeddings
    # across vectorstore build time and query time (critical for retrieval quality)
    embeddings = LocalEmbeddings('all-mpnet-base-v2')
    print("✅ LocalEmbeddings initialized (768-dim, offline, balanced quality/speed)")
    print("   Note: First run will download model (~420MB), then cached locally")


    # Initialize LLM for text generation with configured parameters
    llm = HKBULLM(
        api_key=API_KEY,
        base_url=BASE_URL,
        model=FAISS_MODEL_NAME,
        api_version=FAISS_API_VERSION,
        temperature=FAISS_TEMPERATURE,
        max_tokens=FAISS_MAX_TOKENS,
    )
    print("✅ HKBU LLM initialized for text generation")

    # Cascade rebuild/force_delete flags: single flags override specific flags
    rebuild_java = rebuild_java or rebuild_vectorstore
    rebuild_platform = rebuild_platform or rebuild_vectorstore
    force_delete_java = force_delete_java or force_delete
    force_delete_platform = force_delete_platform or force_delete

    # Load or build split vectorstores (may return None if docs not found)
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

    # Count active vectorstores to decide retrieval strategy
    active_vectorstores = [vectorstore for vectorstore in (java_vectorstore, platform_vectorstore) if vectorstore is not None]

    # Fallback to legacy unified vectorstore if no split stores available
    if not active_vectorstores and is_vectorstore_ready(LEGACY_VECTORSTORE_PATH):
        print("Loading legacy unified vectorstore as fallback...")
        legacy_vectorstore = load_faiss_with_forced_embeddings(LEGACY_VECTORSTORE_PATH, embeddings)
        annotate_vectorstore_docs(legacy_vectorstore, "legacy")
        # Simple MMR retriever from single legacy store (no routing needed)
        retriever = legacy_vectorstore.as_retriever(
            search_type="mmr",
            search_kwargs={"k": K_DOCUMENTS, "fetch_k": FETCH_K, "lambda_mult": LAMBDA_MULT},
        )
        print(f"✅ Loaded legacy vectorstore with {legacy_vectorstore.index.ntotal} vectors")
    else:
        # Use RoutedRetriever to intelligently route queries between split stores
        retriever = RoutedRetriever(
            java_vectorstore=java_vectorstore,
            platform_vectorstore=platform_vectorstore,
            k=K_DOCUMENTS,
        )

    # Verify at least one knowledge base is available; fail fast if not
    if not active_vectorstores:
        raise ValueError(
            f"No documents found in split knowledge-base folders ({DOCS_JAVA_DIR}, {DOCS_PLATFORM_DIR}) "
            f"and no legacy vectorstore found at {LEGACY_VECTORSTORE_PATH}."
        )

    # Build RAG chain with retriever and LLM
    print("Building RAG chain...")
    rag_chain, retriever = build_rag_chain(retriever, llm)

    # Log summary of RAG system configuration
    print("✅ FAISS RAG system ready!")
    print(f"   Active vectorstores: {len(active_vectorstores)}")
    print(f"   Retrieval mode: {'legacy-unified' if len(active_vectorstores) == 1 and java_vectorstore is None and platform_vectorstore is None else 'routed-split'}")
    print()

    return rag_chain, retriever
#!/usr/bin/env python3
"""
Rebuild FAISS vectorstores using LOCAL offline embeddings (sentence-transformers).
No API calls = no rate limiting, no 403 errors, fast and cheap.
Run: python rebuild_vectorstore.py
"""
import os
import sys
from pathlib import Path
from sentence_transformers import SentenceTransformer
from langchain_core.embeddings import Embeddings
from typing import List


class LocalEmbeddings(Embeddings):
    """LangChain-compatible wrapper around SentenceTransformer."""

    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        self._model = SentenceTransformer(model_name)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return self._model.encode(texts, convert_to_numpy=True).tolist()

    def embed_query(self, text: str) -> List[float]:
        return self._model.encode(text, convert_to_numpy=True).tolist()

# Add project root to path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

def main():
    from dotenv import load_dotenv
    load_dotenv()
    
    # Import AFTER .env is loaded
    from langchain_community.vectorstores import FAISS
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from langchain_community.document_loaders import TextLoader
    from langchain_core.documents import Document
    import json as _json
    import time
    
    print("\n" + "="*70)
    print("🔄 REBUILDING BOTH VECTORSTORES (Offline Mode)")
    print("="*70)
    print("\n📚 Source directories:")
    print("  • Java Knowledge:  java_docs/java_knowledge/")
    print("  • Platform Guide:  java_docs/platform_guide/")
    print("\n💾 Target directories:")
    print("  • Java Knowledge:  vectorstore/java_knowledge/")
    print("  • Platform Guide:  vectorstore/platform_guide/")
    print("\n⚡ Using LOCAL embeddings (sentence-transformers)")
    print("   No API calls, no rate limits, ~2-3 mins total\n")
    
    # Load local embedding model (all-mpnet-base-v2 is ~420MB, balanced speed/quality)
    print("Loading embedding model...")
    embeddings = LocalEmbeddings('all-mpnet-base-v2')
    dim = embeddings._model.get_sentence_embedding_dimension()
    print(f"✅ Model loaded: {dim}-dim embeddings (768-dim, better quality)\n")
    
    # Rebuild java_knowledge
    rebuild_vectorstore(
        name="java_knowledge",
        docs_dir=PROJECT_ROOT / "java_docs" / "java_knowledge",
        vectorstore_path=PROJECT_ROOT / "vectorstore" / "java_knowledge",
        embeddings=embeddings,
    )
    
    # Rebuild platform_guide
    rebuild_vectorstore(
        name="platform_guide",
        docs_dir=PROJECT_ROOT / "java_docs" / "platform_guide",
        vectorstore_path=PROJECT_ROOT / "vectorstore" / "platform_guide",
        embeddings=embeddings,
    )
    
    print("\n" + "="*70)
    print("✅ VECTORSTORE REBUILD COMPLETE!")
    print("="*70)
    print("\nBoth vectorstores are now ready:")
    print("  ✓ Java knowledge vectorstore")
    print("  ✓ Platform guide vectorstore")
    print("\nYou can now start the backend with:")
    print("  uvicorn main:app --reload\n")

def rebuild_vectorstore(name, docs_dir, vectorstore_path, embeddings):
    """Rebuild a single vectorstore using local embeddings."""
    from langchain_community.vectorstores import FAISS
    from langchain_core.documents import Document
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from langchain_community.document_loaders import TextLoader
    import json as _json
    import time
    import shutil
    
    print(f"\nPreparing {name} vectorstore...")
    
    # Delete old and start fresh
    if vectorstore_path.exists():
        shutil.rmtree(vectorstore_path)
        print(f"🗑️  Deleted old {name} vectorstore")
    
    # Load documents
    print(f"Loading documents from {docs_dir}...")
    all_docs = []
    if not docs_dir.exists():
        print(f"⚠️  Directory not found: {docs_dir}")
        return None
    
    for root, _, files in __import__('os').walk(docs_dir):
        for file in files:
            if file.endswith('.txt'):
                filepath = __import__('os').path.join(root, file)
                try:
                    loader = TextLoader(filepath, encoding='utf-8')
                    docs = loader.load()
                    all_docs.extend(docs)
                except Exception as e:
                    print(f"  ⚠️  Could not load {file}: {e}")
    
    print(f"Loaded {len(all_docs)} documents")
    
    # Tag documents
    for doc in all_docs:
        if not getattr(doc, "metadata", None):
            doc.metadata = {}
        doc.metadata["knowledge_base"] = name
    
    # Chunk documents
    print("✂️ Chunking documents...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", " ", ""],
    )
    chunks = text_splitter.split_documents(all_docs)
    print(f"Created {len(chunks)} chunks")
    
    # Build vectorstore incrementally
    print(f"Creating vectorstore from {len(chunks)} chunks...")
    batch_size = 50  # Larger batches = faster (no API overhead)
    vectorstore = None
    vectorstore_path.mkdir(parents=True, exist_ok=True)
    
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(chunks) + batch_size - 1) // batch_size
        print(f"  Processing batch {batch_num}/{total_batches}...")
        
        batch_store = FAISS.from_documents(batch, embeddings)
        if vectorstore is None:
            vectorstore = batch_store
        else:
            vectorstore.merge_from(batch_store)
        
        vectorstore.save_local(str(vectorstore_path))
        time.sleep(0.5)  # Tiny sleep to keep CPU cool
    
    print(f"✅ Built {name} vectorstore with {vectorstore.index.ntotal} vectors")
    return vectorstore

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

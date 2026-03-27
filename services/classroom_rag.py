
import os
import shutil
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from core.config import API_KEY, BASE_URL, FAISS_EMBEDDING_MODEL, FAISS_EMBEDDING_API_VERSION
from models import HKBUEmbeddings


CLASSROOM_VECTORSTORE_DIR = "vectorstore/classrooms"  # e.g. vectorstore/classrooms/42/
# Ensure classroom vectorstore directory exists
os.makedirs(CLASSROOM_VECTORSTORE_DIR, exist_ok=True)

def get_classroom_vs_path(classroom_id: int) -> str:
    return os.path.join(CLASSROOM_VECTORSTORE_DIR, str(classroom_id))

def get_embeddings():
    return HKBUEmbeddings(
        api_key=API_KEY, base_url=BASE_URL,
        model=FAISS_EMBEDDING_MODEL, api_version=FAISS_EMBEDDING_API_VERSION
    )

def ingest_document(classroom_id: int, file_path: str, filename: str):
    """Chunk and embed a document into the classroom's FAISS index."""
    embeddings = get_embeddings()
    vs_path = get_classroom_vs_path(classroom_id)

    # Load based on file type
    if filename.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    else:
        loader = TextLoader(file_path, encoding="utf-8")
    
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=50)
    chunks = splitter.split_documents(docs)

    # Add classroom_id to metadata for each chunk
    for chunk in chunks:
        chunk.metadata["classroom_id"] = classroom_id
        chunk.metadata["source_file"] = filename

    # Load existing index or create new
    if os.path.exists(vs_path):
        vs = FAISS.load_local(vs_path, embeddings, allow_dangerous_deserialization=True)
        vs.add_documents(chunks)
    else:
        vs = FAISS.from_documents(chunks, embeddings)
    
    vs.save_local(vs_path)
    return len(chunks)

def query_classroom_rag(classroom_id: int, question: str, k: int = 5):
    """Retrieve top-k chunks from a classroom's vector store."""
    embeddings = get_embeddings()
    vs_path = get_classroom_vs_path(classroom_id)

    if not os.path.exists(vs_path):
        return []  # No documents yet
    
    vs = FAISS.load_local(vs_path, embeddings, allow_dangerous_deserialization=True)
    return vs.similarity_search(question, k=k)

def delete_classroom_index(classroom_id: int):
    """Called by admin when deleting a classroom."""
    vs_path = get_classroom_vs_path(classroom_id)
    if os.path.exists(vs_path):
        shutil.rmtree(vs_path)

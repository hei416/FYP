"""
Shared RAG helper functions to reduce code duplication across endpoints.
"""
from typing import List, Dict, Optional, Any, Tuple
import json
import re
from services.conversation_manager import ConversationManager


def clean_chunk_for_display(text: str) -> str:
    """Clean up chunk text for display by removing UI noise and fixing formatting."""
    if not text:
        return text

    # Remove obvious UI/footer noise first
    text = re.sub(
        r'❮\s*Previous\s+Next\s*❯.*?$',
        ' ',
        text,
        flags=re.IGNORECASE | re.DOTALL
    )
    text = re.sub(
        r'\bSign in to track progress\b.*?$',
        ' ',
        text,
        flags=re.IGNORECASE | re.DOTALL
    )

    # Remove W3Schools interactive elements
    text = re.sub(r'Try it Yourself\s*[»›]?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bTry it\s+\w+\s*[»›]?', '', text, flags=re.IGNORECASE)

    # Remove W3Schools navigation/UI noise
    text = re.sub(r'\b(Try it Yourself|Try it Now|Run Example|Edit & Run|Exercise|Quiz Yourself)\s*[»›]?', '', text, flags=re.IGNORECASE)

    # Fix hyphenated line breaks / wrapped words
    text = re.sub(r"(\w)-\s+(\w)", r"\1\2", text)

    # Insert missing space after sentence period only for letter->Uppercase
    text = re.sub(r'(?<=[A-Za-z])\.(?=[A-Z])', '. ', text)

    # Remove figure/table/listing references, including Figure?? and inline captions
    text = re.sub(
        r'\b(Figure|Table|Listing)\s*(?:\?+|\d+(?:\.\d+)*)\s*[:.-]?\s*[A-Za-z][^.:\n]{0,120}',
        ' ',
        text,
        flags=re.IGNORECASE
    )

    # Remove page/section bleed like "6.7 String Iteration 97"
    text = re.sub(
        r'\b\d+\.\d+\s+[A-Z][A-Za-z]+\s+[A-Z][A-Za-z]+\s+\d+\b',
        ' ',
        text
    )

    # Domain-specific loop repairs
    replacements = {
        r'\baforloop\b': 'a for loop',
        r'\bawhileloop\b': 'a while loop',
        r'\btheforloop\b': 'the for loop',
        r'\bthewhileloop\b': 'the while loop',
        r'\bforloops\b': 'for loops',
        r'\bwhileloops\b': 'while loops',
        r'\bbetweenforloops\b': 'between for loops',
        r'\bandwhileloops\b': 'and while loops',
        r'\bonlyinsidetheforloop\b': 'only inside the for loop',
        r'\binsideforloops\b': 'inside for loops',
        r'\billustratesforloops\b': 'illustrates for loops',
    }
    for pattern, repl in replacements.items():
        text = re.sub(pattern, repl, text, flags=re.IGNORECASE)

    # General glue fixes around common loop phrases
    text = re.sub(r'\b([A-Za-z]+)(for loop)\b', r'\1 \2', text, flags=re.IGNORECASE)
    text = re.sub(r'\b([A-Za-z]+)(while loop)\b', r'\1 \2', text, flags=re.IGNORECASE)
    text = re.sub(r'\b(for loop)([A-Za-z]+)\b', r'\1 \2', text, flags=re.IGNORECASE)
    text = re.sub(r'\b(while loop)([A-Za-z]+)\b', r'\1 \2', text, flags=re.IGNORECASE)

    # Collapse repeated punctuation junk like Figure??
    text = re.sub(r'\?{2,}', ' ', text)

    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def build_iframe_url(
    base_url: str,
    classroom_id: Optional[int],
    file_id: Optional[int],
    page_number: int = 1
) -> Optional[str]:
    """Build iframe URL for PDF viewer with page number."""
    if not file_id or not classroom_id:
        return None
    
    # Remove trailing slash from base_url if present
    base_url = base_url.rstrip('/')
    return f"{base_url}/classrooms/{classroom_id}/files/{file_id}/view#page={page_number}"


def build_pdf_matches_from_classroom_chunks(
    chunks_with_metadata: List[Tuple[int, Dict]],
    base_url: str,
    max_matches: int = 3
) -> List[Dict[str, Any]]:
    """
    Build PDF matches from classroom chunks with metadata.
    
    Args:
        chunks_with_metadata: List of (classroom_id, chunk_dict) tuples
        base_url: Base URL for building iframe links
        max_matches: Maximum number of matches to return
        
    Returns:
        List of PDF match dictionaries
    """
    pdf_matches = []
    
    for cid, chunk in chunks_with_metadata[:max_matches]:
        file_id = chunk.get('file_id')
        page_num = chunk.get('page_number', 1)
        filename = chunk.get("filename", f"Classroom {cid} material")
        text = chunk.get("text", "")
        
        iframe_url = build_iframe_url(base_url, cid, file_id, page_num)
        
        pdf_matches.append({
            "file": filename,
            "snippet": text,
            "display_snippet": text[:200] + "..." if len(text) > 200 else text,
            "page": page_num,
            "file_id": file_id,
            "classroom_id": cid,
            "iframeUrl": iframe_url,
            "mime_type": chunk.get("mime_type", "application/pdf"),
        })
    
    return pdf_matches


def build_pdf_matches_from_docs(
    docs: List[Dict],
    base_url: str,
    classroom_id: Optional[int] = None,
    clean_display: bool = True,
    max_matches: int = 3
) -> List[Dict[str, Any]]:
    """
    Build PDF matches from document list (standard format from query_classroom_rag).
    
    Args:
        docs: List of document dictionaries
        base_url: Base URL for building iframe links
        classroom_id: Optional classroom ID for building URLs
        clean_display: Whether to clean snippet text for display
        max_matches: Maximum number of matches to return
        
    Returns:
        List of PDF match dictionaries
    """
    pdf_matches = []
    
    for doc in docs[:max_matches]:
        text = doc.get('page_content', '')
        display_text = clean_chunk_for_display(text) if clean_display else text
        
        file_id = doc.get('file_id')
        page_num = doc.get('page_number', 1)
        filename = doc.get('filename', 'Unknown')
        
        iframe_url = None
        if classroom_id and file_id:
            iframe_url = build_iframe_url(base_url, classroom_id, file_id, page_num)
        
        pdf_matches.append({
            "file": filename,
            "snippet": text,
            "display_snippet": display_text,
            "page": page_num,
            "file_id": file_id,
            "iframeUrl": iframe_url
        })
    
    return pdf_matches


def build_pdf_matches_from_langchain_docs(
    docs: List[Any],
    extract_url_from_content: bool = True,
    max_matches: int = 3
) -> List[Dict[str, Any]]:
    """
    Build PDF matches from LangChain document objects (for general RAG).
    
    Args:
        docs: List of LangChain document objects
        extract_url_from_content: Whether to extract URL from content
        max_matches: Maximum number of matches to return
        
    Returns:
        List of PDF match dictionaries
    """
    def extract_url(content: str) -> Optional[str]:
        """Extract URL from document content if present."""
        for line in content.split('\n'):
            if 'URL:' in line:
                url = line.split('URL:', 1)[1].strip()
                return url if url.startswith('http') else None
        return None
    
    pdf_matches = []
    
    for doc in docs[:max_matches]:
        text = doc.page_content
        iframe_url = extract_url(text) if extract_url_from_content else None
        
        pdf_matches.append({
            "file": doc.metadata.get('source', 'Unknown').split('/')[-1],
            "snippet": text,
            "display_snippet": clean_chunk_for_display(text),
            "page": doc.metadata.get('page', 1),
            "iframeUrl": iframe_url
        })
    
    return pdf_matches


def deduplicate_chunks(
    chunks_with_metadata: List[Tuple[int, Dict]]
) -> Tuple[List[str], List[Tuple[int, Dict]]]:
    """
    Deduplicate chunks based on content.
    
    Args:
        chunks_with_metadata: List of (classroom_id, chunk_dict) tuples
        
    Returns:
        Tuple of (deduplicated_text_list, deduplicated_chunks_with_metadata)
    """
    seen = set()
    deduped_text = []
    deduped_with_meta = []
    
    for cid, chunk in chunks_with_metadata:
        c_key = json.dumps(chunk, sort_keys=True)
        if c_key not in seen:
            seen.add(c_key)
            deduped_text.append(chunk["text"])
            deduped_with_meta.append((cid, chunk))
    
    return deduped_text, deduped_with_meta


def save_rag_conversation(
    conversation_manager: ConversationManager,
    user_id: int,
    conversation_id: str,
    user_message: str,
    assistant_response: str,
    context_type: str,
    pdf_matches: List[Dict],
    code_snippet: Optional[str] = None,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None
) -> None:
    """
    Save RAG conversation turn with standardized error handling.
    
    Args:
        conversation_manager: ConversationManager instance
        user_id: User ID
        conversation_id: Conversation ID
        user_message: User's message
        assistant_response: Assistant's response
        context_type: Type of context (e.g., "classroom_rag", "multi_classroom_rag")
        pdf_matches: List of PDF match dictionaries
        code_snippet: Optional code snippet
        input_tokens: Optional input token count
        output_tokens: Optional output token count
    """
    try:
        conversation_manager.save_turn(
            user_id=user_id,
            conversation_id=conversation_id,
            user_message=user_message,
            assistant_response=assistant_response,
            context_type=context_type,
            code_snippet=code_snippet,
            input_tokens=input_tokens or len(user_message.split()),
            output_tokens=output_tokens or len(assistant_response.split()),
            pdf_matches=pdf_matches,
        )
        print(f"✅ Saved {context_type} conversation turn for user {user_id}")
    except Exception as e:
        print(f"⚠️ Failed to save conversation: {e}")

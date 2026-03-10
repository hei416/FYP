from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import pickle
from functools import lru_cache
import re
from fastapi.responses import HTMLResponse
import requests
from bs4 import BeautifulSoup
import trafilatura
from urllib.parse import urljoin, urlparse

router = APIRouter()

class DocumentRequest(BaseModel):
    filename: str
    source: str

# Cache the vectorstore loading
@lru_cache(maxsize=1)
def load_vectorstore():
    """Load and cache vectorstore"""
    try:
        with open('./vectorstore/index.pkl', 'rb') as f:
            store_data = pickle.load(f)
        
        if isinstance(store_data, tuple) and len(store_data) >= 1:
            docstore = store_data[0]
            
            if hasattr(docstore, '_dict'):
                return docstore._dict
        
        raise ValueError("Invalid vectorstore structure")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load vectorstore: {str(e)}")
def parse_document_metadata(content: str):
    """
    Parse document metadata from content header and remove it.
    """
    metadata = {
        'title': None,
        'source_name': None,
        'url': None,
        'has_metadata': False
    }
    
    lines = content.split('\n')
    content_start_idx = 0
    
    # Check first 20 lines for metadata block
    for i, line in enumerate(lines[:20]):
        line_stripped = line.strip()
        
        # Filename line
        if i == 0 and line_stripped.endswith('.txt'):
            metadata['has_metadata'] = True
            continue
        
        # Parse metadata fields
        if line_stripped.startswith('Title:'):
            metadata['title'] = line_stripped.replace('Title:', '').strip()
            metadata['has_metadata'] = True
            
        elif line_stripped.startswith('Source:'):
            source = line_stripped.replace('Source:', '').strip()
            # Keep the more descriptive source name (longer one)
            if source not in ['w3schools', 'books', 'oracle', 'geeksforgeeks']:
                if not metadata['source_name'] or len(source) > len(metadata['source_name']):
                    metadata['source_name'] = source
            metadata['has_metadata'] = True
            
        elif line_stripped.startswith('URL:'):
            url = line_stripped.replace('URL:', '').strip()
            # Remove markdown link syntax
            if '[' in url and '](' in url:
                import re
                match = re.search(r'\]\((.*?)\)', url)
                if match:
                    url = match.group(1)
            metadata['url'] = url
            metadata['has_metadata'] = True
        
        # First substantive content line (not metadata)
        elif metadata['has_metadata'] and line_stripped and not line_stripped.startswith(('Source:', 'Title:', 'URL:')):
            # This is where content starts
            content_start_idx = i
            break
    
    # Extract clean content (skip metadata block)
    if metadata['has_metadata'] and content_start_idx > 0:
        clean_content = '\n'.join(lines[content_start_idx:]).strip()
    else:
        clean_content = content
    
    return metadata, clean_content



# In your backend document.py

import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

def extract_chapter_from_book(content: str, filename: str) -> str:
    """Extract specific chapter from Think Java book content"""
    
    # Debug logging
    print(f"🔍 Extracting chapter from: {filename}")
    print(f"📄 Content length: {len(content)} characters")
    
    # Check if looking for a specific chapter
    chapter_match = re.search(r'chapter[_\s](\d+)', filename.lower())
    
    if not chapter_match:
        print("❌ No chapter number in filename, returning first 8000 chars")
        # Return introduction/first portion
        return content[:8000] + "\n\n...[Content continues - full book available in Text View]"
    
    chapter_num = int(chapter_match.group(1))
    print(f"✅ Looking for Chapter {chapter_num}")
    
    # Think Java specific patterns
    patterns = [
        # "Chapter 1\nThe Way of the Program"
        rf'(Chapter {chapter_num}\n[^\n]+)(.*?)(?=Chapter {chapter_num + 1}\n|Appendix [A-Z]\n|$)',
        
        # Alternative: just "Chapter 1" with any content after
        rf'(Chapter {chapter_num}[^\n]*\n)(.*?)(?=Chapter {chapter_num + 1}|$)',
    ]
    
    for i, pattern in enumerate(patterns):
        match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if match:
            chapter_title = match.group(1).strip()
            chapter_content = match.group(2).strip()
            
            print(f"✅ Pattern {i} matched! Title: {chapter_title}")
            print(f"📏 Content length: {len(chapter_content)} chars")
            
            if len(chapter_content) > 300:  # Valid chapter
                return f"{chapter_title}\n\n{chapter_content}"
            else:
                print(f"⚠️ Content too short: {len(chapter_content)} chars")
    
    print("❌ No chapter pattern matched")
    print(f"🔍 Searching for 'Chapter {chapter_num}' in content...")
    
    # Find where "Chapter X" appears
    chapter_pos = content.find(f"Chapter {chapter_num}\n")
    if chapter_pos != -1:
        print(f"✅ Found 'Chapter {chapter_num}' at position {chapter_pos}")
        # Show context around it
        context_start = max(0, chapter_pos - 100)
        context_end = min(len(content), chapter_pos + 500)
        print(f"Context: ...{content[context_start:context_end]}...")
        
        # Extract from this position to next chapter
        next_chapter_pos = content.find(f"Chapter {chapter_num + 1}\n", chapter_pos + 1)
        if next_chapter_pos != -1:
            return content[chapter_pos:next_chapter_pos]
        else:
            # Last chapter or appendix
            appendix_pos = content.find("Appendix", chapter_pos + 1)
            if appendix_pos != -1:
                return content[chapter_pos:appendix_pos]
            else:
                # Return rest of book
                return content[chapter_pos:]
    else:
        print(f"❌ 'Chapter {chapter_num}' not found in content")
    
    # Absolute fallback
    return content[:8000] + "\n\n...[Chapter extraction failed - showing first portion]"

@router.post("/api/document/content")
async def get_document_content(request: DocumentRequest):
    """Retrieve document content and extract chapters if needed"""
    
    try:
        docs_dict = load_vectorstore()
        
        all_chunks = []
        file_metadata = None
        
        for doc_id, doc in docs_dict.items():
            metadata = doc.metadata if hasattr(doc, 'metadata') else {}
            source_path = metadata.get('source', '')
            
            # Match the file
            if request.filename in source_path and request.source in source_path:
                content = doc.page_content if hasattr(doc, 'page_content') else str(doc)
                all_chunks.append(content)
                
                if file_metadata is None:
                    file_metadata = metadata
        
        if not all_chunks:
            raise HTTPException(status_code=404, detail=f"Document not found")
        
        # Combine chunks
        combined_content = '\n\n---CHUNK---\n\n'.join(all_chunks)
        parsed_metadata, clean_content = parse_document_metadata(combined_content)
        
        clean_content = clean_content.replace('---CHUNK---', '')
        
        # ✨ EXTRACT SPECIFIC CHAPTER IF THIS IS A BOOK
        is_book = (
            'books' in source_path.lower() or 
            'javanotes' in source_path.lower() or
            'think_java' in request.filename.lower() or
            'chapter' in request.filename.lower() or
            request.source in ['books', 'javanotes']
        )
        
        if is_book:
            # Extract the specific chapter
            clean_content = extract_chapter_from_book(clean_content, request.filename)
            parsed_metadata['content_type'] = 'chapter'
            
            # Handle book homepage
            if parsed_metadata.get('url'):
                url = parsed_metadata['url']
                if any(domain in url for domain in ['greenteapress.com', 'math.hws.edu', 'opendatastructures.org']):
                    parsed_metadata['book_homepage'] = url
                    parsed_metadata['url'] = None
        
        # Deduplicate paragraphs
        paragraphs = clean_content.split('\n\n')
        deduped_paragraphs = []
        prev_para = None
        
        for para in paragraphs:
            para_clean = para.strip()
            if para_clean and para_clean != prev_para:
                deduped_paragraphs.append(para)
                prev_para = para_clean
        
        final_content = '\n\n'.join(deduped_paragraphs)
        
        return {
            'success': True,
            'content': final_content,
            'chunks_found': len(all_chunks),
            'metadata': {
                **file_metadata,
                **parsed_metadata,
                'is_book': is_book
            },
            'source_path': file_metadata.get('source', '')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/api/document/list")
async def list_documents():
    """List all available documents (for debugging)"""
    try:
        docs_dict = load_vectorstore()
        
        documents = []
        for doc_id, doc in docs_dict.items():
            metadata = doc.metadata if hasattr(doc, 'metadata') else {}
            source_path = metadata.get('source', '')
            
            if '/' in source_path:
                parts = source_path.split('/')
                folder = parts[-2] if len(parts) >= 2 else 'unknown'
                filename = parts[-1]
            else:
                folder = 'unknown'
                filename = source_path
            
            documents.append({
                'filename': filename,
                'source': folder,
                'full_path': source_path
            })
        
        return {
            'success': True,
            'total': len(documents),
            'documents': documents[:50]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/document/search/{query}")
async def search_documents(query: str):
    """Search for documents by partial filename"""
    try:
        docs_dict = load_vectorstore()
        
        matches = []
        for doc_id, doc in docs_dict.items():
            metadata = doc.metadata if hasattr(doc, 'metadata') else {}
            source_path = metadata.get('source', '')
            
            if query.lower() in source_path.lower():
                matches.append({
                    'source_path': source_path,
                    'filename': source_path.split('/')[-1] if '/' in source_path else source_path
                })
        
        return {'matches': matches[:20]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/proxy/webpage")
async def proxy_webpage(url: str):
    """Extract clean content and rewrite links to go through proxy"""
    
    try:
        # Fetch webpage
        response = requests.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }, timeout=10)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch")
        
        # Extract main content with trafilatura
        clean_content = trafilatura.extract(
            response.text,
            include_formatting=True,
            include_links=True,
            include_images=True,
            output_format='html'
        )
        
        if not clean_content:
            raise HTTPException(status_code=404, detail="Could not extract content")
        
        # Parse and rewrite links
        soup = BeautifulSoup(clean_content, 'html.parser')
        base_domain = urlparse(url).netloc
        
        # Rewrite all <a> tags to go through proxy
        for link in soup.find_all('a', href=True):
            original_href = link['href']
            absolute_url = urljoin(url, original_href)
            
            # Only proxy links from same domain
            if urlparse(absolute_url).netloc == base_domain:
                # Rewrite to go through our proxy
                link['href'] = f"/api/proxy/webpage?url={absolute_url}"
                link['target'] = "_self"  # Keep in same iframe
            else:
                # External links open in new tab
                link['target'] = "_blank"
                link['rel'] = "noopener noreferrer"
        
        # Fix image paths to be absolute
        for img in soup.find_all('img', src=True):
            img['src'] = urljoin(url, img['src'])
        
        # Build complete HTML
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Proxied Content</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.7;
                    padding: 20px 40px;
                    max-width: 1000px;
                    margin: 0 auto;
                    background: #ffffff;
                    color: #1a1a1a;
                }}
                
                h1, h2, h3, h4 {{ 
                    color: #1e293b; 
                    margin-top: 1.5em;
                    margin-bottom: 0.5em;
                    font-weight: 600;
                }}
                
                h1 {{ font-size: 2em; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.3em; }}
                h2 {{ font-size: 1.5em; }}
                h3 {{ font-size: 1.25em; }}
                
                p {{ margin-bottom: 1em; }}
                
                pre {{ 
                    background: #1e293b; 
                    color: #e2e8f0; 
                    padding: 16px; 
                    border-radius: 8px; 
                    overflow-x: auto;
                    font-family: 'Courier New', 'Consolas', monospace;
                    font-size: 14px;
                    line-height: 1.5;
                    margin: 1.5em 0;
                }}
                
                code {{ 
                    background: #f1f5f9; 
                    color: #e11d48;
                    padding: 2px 6px; 
                    border-radius: 4px; 
                    font-family: 'Courier New', 'Consolas', monospace;
                    font-size: 0.9em;
                }}
                
                pre code {{
                    background: transparent;
                    color: #e2e8f0;
                    padding: 0;
                }}
                
                img {{ 
                    max-width: 100%; 
                    height: auto; 
                    border-radius: 8px;
                    margin: 1em 0;
                }}
                
                a {{ 
                    color: #3b82f6; 
                    text-decoration: none;
                    border-bottom: 1px solid transparent;
                    transition: border-color 0.2s;
                }}
                
                a:hover {{ 
                    border-bottom-color: #3b82f6;
                }}
                
                blockquote {{
                    border-left: 4px solid #3b82f6;
                    padding-left: 1em;
                    margin-left: 0;
                    color: #64748b;
                    font-style: italic;
                }}
                
                ul, ol {{
                    padding-left: 2em;
                    margin-bottom: 1em;
                }}
                
                li {{
                    margin-bottom: 0.5em;
                }}
                
                table {{
                    border-collapse: collapse;
                    width: 100%;
                    margin: 1.5em 0;
                }}
                
                th, td {{
                    border: 1px solid #e5e7eb;
                    padding: 8px 12px;
                    text-align: left;
                }}
                
                th {{
                    background: #f8fafc;
                    font-weight: 600;
                }}
                
                /* Breadcrumb/navigation hint */
                .proxy-notice {{
                    background: #eff6ff;
                    border-left: 4px solid #3b82f6;
                    padding: 12px 16px;
                    margin-bottom: 20px;
                    font-size: 14px;
                    color: #1e40af;
                    border-radius: 4px;
                }}
            </style>
        </head>
        <body>
            <div class="proxy-notice">
                📄 Viewing: <strong>{url}</strong>
            </div>
            {str(soup)}
        </body>
        </html>
        """
        
        return HTMLResponse(content=html, status_code=200)
        
    except Exception as e:
        # Return friendly error page
        error_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    background: #f9fafb;
                }}
                .error-box {{
                    background: white;
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    max-width: 500px;
                    text-align: center;
                }}
                .error-icon {{
                    font-size: 48px;
                    margin-bottom: 20px;
                }}
                h1 {{
                    color: #dc2626;
                    font-size: 20px;
                    margin-bottom: 12px;
                }}
                p {{
                    color: #64748b;
                    line-height: 1.6;
                }}
                .url {{
                    background: #f1f5f9;
                    padding: 8px 12px;
                    border-radius: 4px;
                    margin-top: 16px;
                    word-break: break-all;
                    font-size: 12px;
                    color: #475569;
                }}
            </style>
        </head>
        <body>
            <div class="error-box">
                <div class="error-icon">⚠️</div>
                <h1>Failed to Load Content</h1>
                <p>Could not extract content from this page. The site may not be accessible or the content format is not supported.</p>
                <div class="url">{url}</div>
                <p style="margin-top: 20px; font-size: 14px;">
                    <a href="{url}" target="_blank" style="color: #3b82f6; text-decoration: none;">
                        Open original page in new tab →
                    </a>
                </p>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=error_html, status_code=200)
    
@router.get("/api/document/debug/{source}")
async def debug_documents(source: str):
    """Debug: Show all files from a specific source"""
    try:
        docs_dict = load_vectorstore()
        
        files = []
        for doc_id, doc in docs_dict.items():
            metadata = doc.metadata if hasattr(doc, 'metadata') else {}
            source_path = metadata.get('source', '')
            
            if source in source_path.lower():
                files.append({
                    'source_path': source_path,
                    'filename': source_path.split('/')[-1] if '/' in source_path else source_path,
                    'content_preview': (doc.page_content[:200] if hasattr(doc, 'page_content') else str(doc)[:200])
                })
        
        return {'found': len(files), 'files': files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

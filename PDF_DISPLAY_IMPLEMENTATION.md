# Classroom RAG PDF Display Implementation

## Overview
This implementation enables classroom RAG to display retrieved PDF documents in an iframe directly within the chat interface, showing the actual PDF page where the content was retrieved from.

## Changes Made

### 1. Database Schema ([db_models.py](db_models.py))
- Added `page_number` column to `ClassroomChunk` model to track which PDF page each chunk came from
- Default value: 1 (for non-PDF files)

### 2. Backend - Text Extraction with Page Tracking ([services/classroom_rag.py](services/classroom_rag.py))
- **New function: `_extract_text_with_pages()`**
  - Extracts text from PDFs page-by-page while preserving page numbers
  - Returns list of tuples: `[(text, page_num), ...]`
  - Page numbers are 1-indexed for PDFs, 0 for other file types

- **Updated: `upload_and_index()`**
  - Now uses `_extract_text_with_pages()` to capture page information
  - Stores page number with each chunk in the database
  - Chunks maintain their original PDF page numbers

- **Updated: `search_classroom_context()`**
  - Now returns page numbers in the results
  - Each chunk includes: `{"text": ..., "file_id": ..., "filename": ..., "page_number": ...}`

### 3. RAG Endpoints ([routers/rag.py](routers/rag.py) & [routers/classroom.py](routers/classroom.py))

**Classroom RAG (`/classroom/{classroom_id}/ask`)**
- Enhanced `pdf_matches` structure to include:
  - `file_id`: For serving the PDF file
  - `page`: Page number where content was found
  - `iframeUrl`: Direct link to view the PDF at the specific page
  - `snippet` & `display_snippet`: Text content

**Multi-Classroom RAG (`/classrooms/ask-multi`)**
- Similar enhancements with support for multiple classrooms
- Preserves metadata for each retrieved chunk

### 4. Frontend PDF Display ([frontend/src/AI.js](frontend/src/AI.js))
- **PDF Viewer Component**:
  - When expanded, displays an embedded PDF viewer in an iframe (600px height)
  - Shows the actual PDF file from the database
  - Jumps to the correct page using URL anchor (`#page=N`)
  - Falls back gracefully for non-PDF sources

- **Enhanced UI**:
  - Source buttons now show page numbers (e.g., "Classroom material 1 (Page 5)")
  - PDF viewer displays above the text snippet for better context
  - Maintains all existing functionality (text preview, context expansion, etc.)

## How It Works

### User Flow:
1. User asks a question in a classroom chat
2. Backend searches through uploaded PDFs using semantic search
3. For each retrieved chunk, the system knows:
   - Which file it came from (`file_id`)
   - Which page it was on (`page_number`)
4. Backend returns structured data with an `iframeUrl` pointing to the PDF file
5. Frontend renders:
   - Source button with file name and page number
   - When expanded, shows both the PDF and the text snippet

### Technical Details:
- **PDF Extraction**: Uses PyMuPDF (fitz) to extract text page-by-page
- **URL Fragment**: `#page=N` uses standard PDF viewer behavior to navigate to page
- **Database Storage**: Page numbers stored in `classroom_chunks.page_number` column
- **File Serving**: Existing endpoint `GET /classrooms/{classroom_id}/files/{file_id}/view` serves PDFs inline

## Migration Steps

1. **Update database schema:**
   ```bash
   python migrate_add_page_number.py
   ```
   This adds the `page_number` column to existing databases

2. **Re-upload classroom documents** (optional):
   - Old documents will work fine but won't have page number tracking
   - New documents uploaded will automatically track page numbers
   - To add page tracking to old documents, re-upload them

3. **Restart backend:**
   ```bash
   uvicorn main:app --reload
   ```

## Features

✅ **Displays actual PDF in iframe** - Shows the source document directly
✅ **Page tracking** - Knows exactly which page content came from  
✅ **Page jumping** - URL fragment navigates to the specific page
✅ **Multiple formats** - Works with PDFs, DOCX, TXT, and other files
✅ **Multi-classroom** - Supports merged searches across multiple classrooms
✅ **Fallback UI** - Gracefully handles non-PDF sources with text snippets
✅ **Database-backed** - Files stored in PostgreSQL, not disk

## Browser Compatibility

- Modern browsers with PDF viewer support (Chrome, Firefox, Safari, Edge)
- PDF.js embedded viewer handles page navigation
- Mobile browsers may display PDF in native viewer

## Limitations

- Page numbers only tracked for PDFs (other formats show page 0/1)
- PDF page limit: standard browsers handle PDFs up to ~1000 pages
- File size limit: 20 MB per document
- PDF URL fragment works best with Mozilla PDF.js viewer

## Testing

To test the feature:

1. Upload a PDF to a classroom
2. Ask a question that should retrieve content from the PDF
3. Click expand on a source - should show PDF and text snippet
4. PDF should display at the correct page (check URL fragment)
5. Can scroll in PDF, zoom, etc. using standard viewer controls

## Future Enhancements

- Add PDF highlight/annotation on retrieved text
- Custom PDF viewer with better controls
- Search within PDF viewer
- Batch re-index old documents to add page numbers
- Support for other document formats (Excel, PowerPoint, etc.)

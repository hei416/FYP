# Quick Start: PDF Display in Classroom RAG

## What's New

✅ Classroom RAG now displays retrieved content **directly in an embedded PDF viewer**
✅ Shows the **exact page** where the answer was found
✅ Works alongside the text snippet for full context

## Before & After

### Before
- Text snippet shown in a collapsible panel
- No way to see the original PDF context
- No page reference

### After  
- **PDF Viewer iframe** displays the actual document
- **Page number** shown in the button (e.g., "Classroom material 1 (Page 5)")
- **URL fragment** navigates to the specific page (`#page=5`)
- Text snippet still available below the PDF

## Installation

### Step 1: Update Database
```bash
cd /Users/hei/IdeaProjects/fyp
python3 migrate_add_page_number.py
```

### Step 2: No other setup needed!
- Updated code is ready to use
- New PDFs will automatically track page numbers
- Old PDFs will still work (without page tracking)

## How to Use

1. **Upload a PDF** to a classroom (via classroom file manager)
2. **Ask a question** in the AI chat about that PDF
3. **Click the source button** to expand it
4. **See the PDF** displayed in the iframe showing the exact page
5. **Use the PDF viewer controls** to zoom, scroll, etc.

## Behind the Scenes

- **Page Tracking**: When PDFs are uploaded, text is extracted page-by-page
- **Smart Retrieval**: When you ask a question, the system finds the right page
- **URL Format**: `/classrooms/{classroom_id}/files/{file_id}/view#page={page_number}`
- **Database Storage**: Page numbers stored with each text chunk

## Troubleshooting

| Issue | Solution |
|-------|----------|
| PDF not showing | Check that the PDF was successfully uploaded |
| Wrong page shown | File might not have page tracking (re-upload to fix) |
| Iframe blank | Browser might need permissions or PDF.js support |
| Very slow | Large PDFs (100+ pages) may load slowly |

## Files Changed

- `db_models.py` - Added `page_number` column
- `services/classroom_rag.py` - Page tracking logic
- `routers/rag.py` - RAG endpoint with iframeUrl
- `routers/classroom.py` - Multi-classroom RAG support
- `frontend/src/AI.js` - PDF viewer display
- `migrate_add_page_number.py` - Database migration

## Technical Details

**Page Extraction** (PyMuPDF):
```python
doc = fitz.open(stream=data, filetype="pdf")
for page_num, page in enumerate(doc, start=1):
    text = page.get_text()  # Preserves page number
```

**Response Format**:
```json
{
  "file": "lecture9.pdf",
  "page": 5,
  "iframeUrl": "/classrooms/1/files/42/view#page=5",
  "snippet": "...",
  "display_snippet": "..."
}
```

**Frontend Rendering**:
```jsx
<iframe 
  src={m.iframeUrl} 
  height={600}
  title={m.file}
/>
```

## Next Steps

- Test with different PDF formats (try PDFs with tables, images, etc.)
- Check page accuracy with multi-page documents
- Monitor performance with large files
- Collect feedback on usability

## Support

For issues or questions:
1. Check the PDF was uploaded successfully
2. Verify the database migration ran
3. Check browser console for errors
4. Re-upload the PDF to get fresh page tracking

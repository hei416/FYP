# Text Highlight "Ask AI" Feature

## Overview
This feature allows users to highlight any text on the webpage and automatically ask the AI about it with a single click.

## How It Works

### User Experience
1. User selects/highlights any text on the page
2. A button appears above the selection: "Ask AI about this" 
3. Clicking the button:
   - Opens the AI chat (if not already open)
   - Automatically submits the query: "Explain this: [selected text]"
   - AI responds without user needing to press send

### Implementation

#### Files Modified/Created

1. **`frontend/src/components/TextHighlightButton.js`** (NEW)
   - React component that listens for text selection events
   - Shows a popup button when text is selected
   - Styled with gradient background and smooth animations
   - Positioned above the selected text

2. **`frontend/src/AI.js`** (MODIFIED)
   - Added `submitQuery()` function to programmatically send queries
   - Exposed via `externalInputRef` for external components to use
   - Refactored `handleSubmit()` to use shared `submitQuery()` logic

3. **`frontend/src/App.js`** (MODIFIED)
   - Imported `TextHighlightButton` component
   - Created `aiInputRef` to communicate with AI component
   - Added `handleAskAI()` callback that:
     - Opens the AI chat
     - Automatically submits the highlighted text as a query

## Technical Details

### Text Selection Detection
- Uses `window.getSelection()` API
- Listens to `mouseup` and `selectionchange` events
- Calculates button position based on selection bounding box

### Auto-Submit Flow
```
User highlights text
  → TextHighlightButton shows
    → User clicks button
      → handleAskAI() called with selected text
        → Opens AI chat via setShowChat(true)
          → Calls submitQuery() with formatted question
            → AI processes and responds automatically
```

### Button Styling
- Gradient background (accent color to purple)
- Smooth fade-in animation
- Hover effects (lift and shadow)
- Positioned absolutely above selection
- Z-index: 10000 (above most UI elements)

### Query Format
Selected text is wrapped as: `Explain this: "[selected text]"`

You can modify this format in `App.js` → `handleAskAI()` function.

## Customization

### Change Query Format
Edit `frontend/src/App.js`:
```javascript
const handleAskAI = (text) => {
    if (aiInputRef.current) {
        aiInputRef.current.setShowChat(true);
        setTimeout(() => {
            // Modify this line to change the query format
            aiInputRef.current.submitQuery(`Your custom prompt: "${text}"`);
        }, 100);
    }
};
```

### Change Button Text
Edit `frontend/src/components/TextHighlightButton.js`:
```javascript
Ask AI about this  // Change this text
```

### Change Button Style
Modify the `style` object in `TextHighlightButton.js` button element.

### Adjust Position
Modify the `setPosition` calculation in `handleTextSelection()`:
```javascript
setPosition({
    top: rect.top + window.scrollY - 45,  // Adjust vertical offset
    left: rect.left + window.scrollX + (rect.width / 2) - 75,  // Adjust horizontal
});
```

## Browser Compatibility
- ✅ Chrome/Edge (tested)
- ✅ Firefox (tested)
- ✅ Safari (should work)
- ❌ IE11 (not supported - uses modern APIs)

## Future Enhancements
- [ ] Add keyboard shortcut (e.g., Ctrl+Shift+A)
- [ ] Show loading indicator while AI processes
- [ ] Add option to ask different types of questions (summarize, translate, etc.)
- [ ] Support for selecting text across multiple elements
- [ ] Remember user's preferred query format

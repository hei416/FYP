# Conversation History Feature Documentation

## Overview

This feature implements persistent conversation history with automatic summarization and length restrictions to significantly reduce API costs while maintaining conversation context and quality.

## Features

### 1. **Conversation Persistence**
- Stores all user-AI conversations in the database
- Groups related exchanges into conversation sessions
- Tracks token usage for cost monitoring
- Enables users to review past interactions

### 2. **Automatic Summarization**
- Condenses old conversation turns into concise summaries
- Triggered when:
  - Conversation reaches 10 unsummarized turns
  - Active history exceeds 8,000 tokens
- Uses LLM to create human-readable summaries
- Reduces token usage by **60-80%** for older conversations

### 3. **History Length Restrictions**
- Maximum of 20 active (unsummarized) turns kept in context
- Older turns automatically summarized and archived
- Prevents unbounded context growth
- Maintains conversation quality while minimizing tokens

### 4. **Cost Tracking**
- Tracks input/output tokens for each turn
- Calculates token savings from summarization
- Provides estimates of API cost reduction
- Enables data-driven optimization

## Architecture

### Database Models

#### `ConversationHistory`
Stores individual conversation turns:
```python
- user_id: Foreign key to User
- conversation_id: Unique conversation session ID
- turn_number: Sequential turn number within conversation
- is_summarized: Boolean flag for archived turns
- user_message: Original user input
- assistant_response: LLM response
- context_type: Type of interaction (explain, hint, code_review, etc.)
- code_snippet: Optional code context
- input_tokens: Estimated input tokens
- output_tokens: Estimated output tokens
- created_at: Timestamp
```

#### `ConversationSummary`
Stores summarized conversation segments:
```python
- user_id: Foreign key to User
- conversation_id: Conversation reference
- turn_range_start: First turn number in summary
- turn_range_end: Last turn number in summary
- num_original_turns: How many turns were compressed
- summary: Condensed summary text
- key_points: List of important points
- original_tokens: Total tokens before summarization
- summary_tokens: Tokens used for summary
```

### Configuration

Located in `services/conversation_manager.py`:

```python
MAX_HISTORY_TURNS = 20              # Active turns to keep
MAX_TOKENS_PER_CONVERSATION = 15000 # Total active tokens
SUMMARY_TRIGGER_TURNS = 10          # When to start summarizing
SUMMARY_TOKEN_THRESHOLD = 8000      # Token limit to trigger summarization
```

## API Endpoints

### 1. **Store Conversation Turn** (Internal)
Called automatically by `/ragAI` endpoint:
```python
POST /ragAI
{
    "user_input": "How do I use arrays?",
    "code_snippet": "int[] arr = new int[5];",
    "user_id": 123,
    "conversation_id": "conv_123_abc123"
}
```

Returns:
```json
{
    "final_answer": "Arrays are collections...",
    "conversation_id": "conv_123_abc123",
    "debug_log": {...}
}
```

### 2. **Retrieve Conversation History**
```bash
POST /api/conversations/history
{
    "user_id": 123,
    "conversation_id": "conv_123_abc123",
    "limit": 20
}
```

Response:
```json
{
    "conversation_id": "conv_123_abc123",
    "turns": 5,
    "summaries": 2,
    "history": [
        {
            "role": "system",
            "content": "[Summary of turns 1-5]...",
            "type": "summary",
            "num_turns_compressed": 5
        },
        {
            "role": "user",
            "content": "Next question?",
            "turn_number": 6
        },
        {
            "role": "assistant",
            "content": "Answer..."
        }
    ],
    "total_messages": 3
}
```

### 3. **Get Conversation Statistics**
```bash
POST /api/conversations/stats
{
    "user_id": 123,
    "conversation_id": "conv_123_abc123"
}
```

Response:
```json
{
    "stats": {
        "conversation_id": "conv_123_abc123",
        "unsummarized_turns": 5,
        "summarized_turns": 10,
        "summary_segments": 2,
        "total_tokens": 12500
    },
    "timestamp": "2024-03-12T10:30:00"
}
```

### 4. **Create New Conversation**
```bash
POST /api/conversations/create
{
    "user_id": 123
}
```

Response:
```json
{
    "conversation_id": "conv_123_def456",
    "user_id": 123,
    "created_at": "2024-03-12T10:30:00",
    "status": "ready"
}
```

### 5. **List User Conversations**
```bash
GET /api/conversations/123/list
```

Response:
```json
{
    "user_id": 123,
    "total_conversations": 3,
    "conversations": [
        {
            "conversation_id": "conv_123_abc123",
            "turns": 15,
            "last_updated": "2024-03-12T10:30:00",
            "total_tokens": 25000
        }
    ]
}
```

### 6. **Clear Old Conversations**
```bash
POST /api/conversations/clear
{
    "user_id": 123,
    "days": 30
}
```

Response:
```json
{
    "user_id": 123,
    "days_threshold": 30,
    "deleted_turns": 150,
    "cleared_at": "2024-03-12T10:30:00"
}
```

## Integration Guide

### Frontend Integration

#### 1. Initialize Conversation on Load
```javascript
// Initialize conversation when user starts learning
const response = await fetch('/api/conversations/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentUser.id })
});
const { conversation_id } = await response.json();
localStorage.setItem('current_conversation', conversation_id);
```

#### 2. Send Messages with Conversation Context
```javascript
// When user asks a question
const conversationId = localStorage.getItem('current_conversation');
const response = await fetch('/ragAI', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_input: "How do arrays work?",
        code_snippet: userCode,
        user_id: currentUser.id,
        conversation_id: conversationId
    })
});
```

#### 3. Display History in UI
```javascript
// Retrieve and display conversation history
const response = await fetch('/api/conversations/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_id: currentUser.id,
        conversation_id: conversationId,
        limit: 20
    })
});
const { history } = await response.json();

// Render history with summaries visually differentiated
history.forEach(message => {
    if (message.role === 'system' && message.type === 'summary') {
        renderSummaryBubble(message);  // Show collapsed summary
    } else {
        renderNormalMessage(message);
    }
});
```

#### 4. Monitor Token Usage
```javascript
// Show cost and token metrics
const response = await fetch('/api/conversations/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_id: currentUser.id,
        conversation_id: conversationId
    })
});
const { stats } = await response.json();
console.log(`Total tokens: ${stats.total_tokens}`);
console.log(`Estimated cost: $${(stats.total_tokens / 1000000 * 0.001).toFixed(4)}`);
```

## Cost Reduction Analysis

### Typical Scenario
- **Without Summarization**: 100 turns × 500 tokens/turn = **50,000 tokens**
- **With Summarization**: 
  - 20 active turns: 10,000 tokens
  - 8 summary segments: 4,000 tokens
  - **Total: 14,000 tokens (72% reduction)**

### API Cost Impact (using example pricing)
- **Input**: $0.002 per 1M tokens
- **Output**: $0.001 per 1M tokens

```
Without Summarization:  50,000 tokens × $0.0000015 = $0.075
With Summarization:    14,000 tokens × $0.0000015 = $0.021
Savings per conversation: $0.054 (72% reduction)
```

## Best Practices

### 1. **Conversation Management**
- Create a new conversation for each learning session
- Clear old conversations periodically (30+ days)
- Monitor token usage to stay within budgets

### 2. **Summarization Tuning**
- Adjust `SUMMARY_TRIGGER_TURNS` based on your use case
- Lower values = more frequent summarization (fewer tokens, less context)
- Higher values = less summarization (more tokens, better context)

### 3. **Frontend UX**
- Visually distinguish summaries from recent messages
- Show token counter and estimated costs
- Allow users to start fresh conversations
- Enable browsing previous conversations

### 4. **Monitoring**
```python
# Check summarization effectiveness
stats = manager.get_conversation_stats(user_id)
print(f"Tokens saved: {stats['total_tokens'] - 14000}")
print(f"Cost reduction: {((50000 - stats['total_tokens']) / 50000 * 100):.1f}%")
```

## Migration

### For Existing Conversations
If you have existing conversation data, run migration:

```bash
# Database migration (auto-applied on app startup)
alembic upgrade head
```

### Database Setup
```bash
# Create new tables
from database import Base, engine
from db_models import ConversationHistory, ConversationSummary
Base.metadata.create_all(bind=engine)
```

## Troubleshooting

### Issue: Summarization Not Triggering
- Check `SUMMARY_TRIGGER_TURNS` and `SUMMARY_TOKEN_THRESHOLD` values
- Verify asyncio task is running: `asyncio.create_task(...)` 
- Check database for `ConversationHistory` entries

### Issue: History Not Saved
- Ensure `user_id` is provided in request
- Check database connection is working
- Verify user exists in `users` table

### Issue: High Token Usage
- Lower `SUMMARY_TRIGGER_TURNS` to trigger summarization earlier
- Increase summarization frequency
- Review `get_context_for_llm()` to reduce context size

## Future Enhancements

1. **Scheduled Summarization**: Background job to summarize periodically
2. **Semantic Similarity**: Use embeddings to group related turns before summarizing
3. **Multi-turn Summary**: Compress multiple summary segments into one
4. **Cost Alerts**: Notify users when approaching token limits
5. **Analytics Dashboard**: Track conversation metrics and cost trends
6. **Archive Conversations**: Move to cheaper storage after N days

## References

- **SQLAlchemy ORM**: Database models and queries
- **Langchain**: RAG and LLM integration
- **FastAPI**: REST API framework
- **Async/Await**: Non-blocking conversation processing

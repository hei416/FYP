"""
Example: Using the Conversation History Feature

This example shows how to use the conversation history system in your application.
"""

from services.conversation_manager import ConversationManager
from datetime import datetime
import asyncio

# ============================================================================
# EXAMPLE 1: Basic Conversation Flow
# ============================================================================

async def example_basic_conversation():
    """Example: User asks multiple questions in a conversation"""
    
    manager = ConversationManager()
    user_id = 1
    
    # Create a new conversation
    conversation_id = manager.create_conversation_id(user_id)
    print(f"Created conversation: {conversation_id}")
    
    # Save first turn
    manager.save_turn(
        user_id=user_id,
        conversation_id=conversation_id,
        user_message="How do arrays work in Java?",
        assistant_response="Arrays are fixed-size collections of elements...",
        context_type="explain",
        input_tokens=50,
        output_tokens=100,
    )
    
    # Save second turn
    manager.save_turn(
        user_id=user_id,
        conversation_id=conversation_id,
        user_message="How do I create an array of strings?",
        assistant_response="You can create a String array using: String[] names = new String[5];",
        context_type="explain",
        code_snippet="String[] arr;",
        input_tokens=40,
        output_tokens=80,
    )
    
    # Retrieve history
    history = manager.get_conversation_history(user_id, conversation_id)
    print(f"\nConversation history ({len(history)} messages):")
    for msg in history:
        role = msg['role']
        content = msg['content'][:100] + "..." if len(msg['content']) > 100 else msg['content']
        print(f"  {role}: {content}")


# ============================================================================
# EXAMPLE 2: Summarization Trigger
# ============================================================================

async def example_summarization():
    """Example: Watch automatic summarization happen"""
    
    manager = ConversationManager()
    user_id = 2
    conversation_id = manager.create_conversation_id(user_id)
    
    # Simulate multiple turns to trigger summarization
    print("Saving 12 turns to trigger summarization...")
    
    for i in range(12):
        manager.save_turn(
            user_id=user_id,
            conversation_id=conversation_id,
            user_message=f"Question {i+1}: What is concept {i+1}?",
            assistant_response=f"Concept {i+1} is about...",
            context_type="explain",
            input_tokens=50,
            output_tokens=100,
        )
    
    # Check stats
    stats = manager.get_conversation_stats(user_id, conversation_id)
    print(f"\nStats after 12 turns:")
    print(f"  Active turns: {stats.get('unsummarized_turns', 0)}")
    print(f"  Summarized turns: {stats.get('summarized_turns', 0)}")
    print(f"  Total tokens: {stats['total_tokens']}")
    
    # Retrieve history (summaries included)
    history = manager.get_conversation_history(user_id, conversation_id)
    print(f"\nHistory now has {len(history)} messages (including summaries)")
    for msg in history:
        if msg['role'] == 'system':
            print(f"  [SUMMARY] Compressed {msg.get('num_turns_compressed', 0)} turns")


# ============================================================================
# EXAMPLE 3: Context for LLM
# ============================================================================

async def example_context_generation():
    """Example: Generate context string for LLM"""
    
    manager = ConversationManager()
    user_id = 3
    conversation_id = manager.create_conversation_id(user_id)
    
    # Save a few turns
    for i in range(3):
        manager.save_turn(
            user_id=user_id,
            conversation_id=conversation_id,
            user_message=f"Question {i+1}",
            assistant_response=f"Answer to question {i+1}",
            context_type="explain",
            input_tokens=50,
            output_tokens=100,
        )
    
    # Generate context for LLM
    context = manager.get_context_for_llm(user_id, conversation_id)
    print("Context for LLM:")
    print(context)
    print(f"\nContext length: {len(context)} characters")


# ============================================================================
# EXAMPLE 4: Clearing Old Conversations
# ============================================================================

def example_cleanup():
    """Example: Clear conversations older than 30 days"""
    
    manager = ConversationManager()
    user_id = 4
    
    # Delete conversations older than 30 days
    deleted = manager.clear_old_conversations(user_id, days=30)
    print(f"Deleted {deleted} turns from old conversations")


# ============================================================================
# EXAMPLE 5: Analytics
# ============================================================================

def example_analytics():
    """Example: Get usage statistics"""
    
    manager = ConversationManager()
    user_id = 5
    
    # Get all user stats
    stats = manager.get_conversation_stats(user_id)
    print("User analytics:")
    print(f"  Total turns: {stats.get('total_turns', 0)}")
    print(f"  Total tokens used: {stats.get('total_tokens', 0)}")
    print(f"  Estimated API cost: ${stats.get('estimated_cost_usd', 0):.4f}")
    
    # Calculate savings from summarization
    if stats.get('total_summary_segments', 0) > 0:
        tokens_saved = stats.get('total_tokens', 0) * 0.7  # ~70% reduction
        cost_saved = (tokens_saved / 1000000) * 0.0015
        print(f"\n💰 Cost savings from summarization:")
        print(f"  Tokens saved: ~{int(tokens_saved)}")
        print(f"  Money saved: ${cost_saved:.4f}")


# ============================================================================
# EXAMPLE 6: Backend Integration (in routers/rag.py)
# ============================================================================

async def example_backend_integration():
    """Example: How to integrate with /ragAI endpoint"""
    
    print("""
# In routers/rag.py:

from services.conversation_manager import ConversationManager

@router.post("/ragAI")
async def rag_ai(req: ExplainRequest):
    # Initialize conversation manager
    conversation_manager = None
    if req.user_id:
        conversation_manager = ConversationManager()
        
        # Create new conversation if needed
        if not req.conversation_id:
            req.conversation_id = conversation_manager.create_conversation_id(req.user_id)
        
        # Get conversation context
        conv_context = conversation_manager.get_context_for_llm(
            req.user_id, 
            req.conversation_id
        )
        if conv_context:
            query = f"Previous context:\\n{conv_context}\\n\\n---\\n\\nNew question:\\n{query}"
    
    # Process query with LLM
    final_answer = rag_chain(query)
    
    # Save turn to history
    if conversation_manager and req.user_id:
        conversation_manager.save_turn(
            user_id=req.user_id,
            conversation_id=req.conversation_id,
            user_message=req.user_input,
            assistant_response=final_answer,
            context_type="explain",
            code_snippet=req.code_snippet,
            input_tokens=len(query.split()),
            output_tokens=len(final_answer.split()),
        )
    
    return {
        "final_answer": final_answer,
        "conversation_id": req.conversation_id,
        ...
    }
    """)


# ============================================================================
# EXAMPLE 7: Frontend Integration (in React)
# ============================================================================

def example_frontend_integration():
    """Example: Frontend code to use conversation history"""
    
    frontend_code = """
    // React component for conversation management
    
    import React, { useState, useEffect } from 'react';
    
    function ConversationManager({ userId }) {
        const [conversationId, setConversationId] = useState(null);
        const [history, setHistory] = useState([]);
        const [stats, setStats] = useState(null);
        
        // Initialize conversation on component mount
        useEffect(() => {
            createNewConversation();
        }, [userId]);
        
        // Create new conversation
        const createNewConversation = async () => {
            const response = await fetch('/api/conversations/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            const data = await response.json();
            setConversationId(data.conversation_id);
            localStorage.setItem('conversationId', data.conversation_id);
        };
        
        // Send message and save to history
        const sendMessage = async (userMessage, codeSnippet) => {
            const response = await fetch('/ragAI', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_input: userMessage,
                    code_snippet: codeSnippet,
                    user_id: userId,
                    conversation_id: conversationId
                })
            });
            const data = await response.json();
            
            // Refresh history
            refreshHistory();
            return data.final_answer;
        };
        
        // Retrieve conversation history
        const refreshHistory = async () => {
            const response = await fetch('/api/conversations/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    conversation_id: conversationId,
                    limit: 20
                })
            });
            const data = await response.json();
            setHistory(data.history);
        };
        
        // Get statistics
        const getStats = async () => {
            const response = await fetch('/api/conversations/stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    conversation_id: conversationId
                })
            });
            const data = await response.json();
            setStats(data.stats);
        };
        
        return (
            <div className="conversation-manager">
                <div className="history">
                    {history.map((msg, idx) => (
                        <div key={idx} className={`message role-${msg.role}`}>
                            {msg.role === 'system' && msg.type === 'summary' ? (
                                <div className="summary">
                                    [Summary of {msg.num_turns_compressed} turns]
                                    {msg.content}
                                </div>
                            ) : (
                                <p>{msg.content}</p>
                            )}
                        </div>
                    ))}
                </div>
                
                <div className="stats">
                    <p>Tokens: {stats?.total_tokens || 0}</p>
                    <p>Summaries: {stats?.summary_segments || 0}</p>
                </div>
            </div>
        );
    }
    """
    
    print(frontend_code)


# ============================================================================
# Run Examples
# ============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("CONVERSATION HISTORY EXAMPLES")
    print("=" * 70)
    
    print("\n1. Basic Conversation Flow")
    print("-" * 70)
    asyncio.run(example_basic_conversation())
    
    print("\n\n2. Summarization Trigger")
    print("-" * 70)
    asyncio.run(example_summarization())
    
    print("\n\n3. Context Generation")
    print("-" * 70)
    asyncio.run(example_context_generation())
    
    print("\n\n4. Cleanup Old Conversations")
    print("-" * 70)
    example_cleanup()
    
    print("\n\n5. Analytics")
    print("-" * 70)
    example_analytics()
    
    print("\n\n6. Backend Integration")
    print("-" * 70)
    asyncio.run(example_backend_integration())
    
    print("\n\n7. Frontend Integration")
    print("-" * 70)
    example_frontend_integration()

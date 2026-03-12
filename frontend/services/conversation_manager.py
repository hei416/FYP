"""
Conversation History Manager
Handles storage, retrieval, summarization, and pruning of conversation history
to reduce API costs and manage token usage efficiently.
"""

import json
import asyncio
import httpx
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import desc, and_, func
import uuid

from database import SessionLocal
from db_models import (
    ConversationHistory,
    ConversationSummary,
)
from core.config import (
    API_KEY,
    BASE_URL,
    FAISS_MODEL_NAME,
    FAISS_API_VERSION,
)

# Configuration
MAX_HISTORY_TURNS = 20  # Keep last N turns before summarizing
MAX_TOKENS_PER_CONVERSATION = 15000  # Max tokens in active history
SUMMARY_TRIGGER_TURNS = 10  # Summarize when reaching this many turns
SUMMARY_TOKEN_THRESHOLD = 8000  # Summarize if history exceeds this many tokens


class ConversationManager:
    """Manage conversation history with automatic summarization and pruning"""
    
    def __init__(self):
        self.db = SessionLocal()
    
    def __del__(self):
        """Cleanup database session"""
        if self.db:
            self.db.close()
    
    def create_conversation_id(self, user_id: int) -> str:
        """Generate unique conversation ID for a user session"""
        return f"conv_{user_id}_{uuid.uuid4().hex[:12]}"
    
    def save_turn(
        self,
        user_id: int,
        conversation_id: str,
        user_message: str,
        assistant_response: str,
        context_type: str,
        code_snippet: Optional[str] = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
    ) -> ConversationHistory:
        """Save a single conversation turn"""
        try:
            # Get the turn number for this conversation
            last_turn = self.db.query(
                func.max(ConversationHistory.turn_number)
            ).filter(
                and_(
                    ConversationHistory.user_id == user_id,
                    ConversationHistory.conversation_id == conversation_id,
                )
            ).scalar()
            
            turn_number = (last_turn or 0) + 1
            
            # Create and save turn
            turn = ConversationHistory(
                user_id=user_id,
                conversation_id=conversation_id,
                turn_number=turn_number,
                user_message=user_message,
                assistant_response=assistant_response,
                context_type=context_type,
                code_snippet=code_snippet,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                is_summarized=False,
            )
            
            self.db.add(turn)
            self.db.commit()
            self.db.refresh(turn)
            
            print(f"💾 Saved turn {turn_number} for conversation {conversation_id}")
            
            # Check if summarization is needed
            self._check_and_summarize_if_needed(user_id, conversation_id)
            
            return turn
            
        except Exception as e:
            print(f"❌ Error saving turn: {e}")
            self.db.rollback()
            raise
    
    def get_conversation_history(
        self,
        user_id: int,
        conversation_id: str,
        limit: int = MAX_HISTORY_TURNS,
    ) -> List[Dict[str, Any]]:
        """Retrieve conversation history, including summaries of older turns"""
        try:
            # Get recent unsummarized turns
            recent_turns = self.db.query(ConversationHistory).filter(
                and_(
                    ConversationHistory.user_id == user_id,
                    ConversationHistory.conversation_id == conversation_id,
                    ConversationHistory.is_summarized == False,
                )
            ).order_by(
                desc(ConversationHistory.turn_number)
            ).limit(limit).all()
            
            history = []
            
            # Add recent turns (in chronological order)
            for turn in reversed(recent_turns):
                history.append({
                    "role": "user",
                    "content": turn.user_message,
                    "turn_number": turn.turn_number,
                    "timestamp": turn.created_at.isoformat(),
                })
                history.append({
                    "role": "assistant",
                    "content": turn.assistant_response,
                    "turn_number": turn.turn_number,
                    "timestamp": turn.created_at.isoformat(),
                })
            
            # Get summaries of older turns
            summaries = self.db.query(ConversationSummary).filter(
                and_(
                    ConversationSummary.user_id == user_id,
                    ConversationSummary.conversation_id == conversation_id,
                )
            ).order_by(
                ConversationSummary.turn_range_start.desc()
            ).all()
            
            for summary in reversed(summaries):
                history.insert(0, {
                    "role": "system",
                    "content": f"[Summary of turns {summary.turn_range_start}-{summary.turn_range_end}]\n{summary.summary}",
                    "type": "summary",
                    "turn_range": [summary.turn_range_start, summary.turn_range_end],
                    "num_turns_compressed": summary.num_original_turns,
                    "original_tokens": summary.original_input_tokens + summary.original_output_tokens,
                })
            
            return history
            
        except Exception as e:
            print(f"❌ Error retrieving history: {e}")
            return []
    
    def get_context_for_llm(
        self,
        user_id: int,
        conversation_id: str,
    ) -> str:
        """Get conversation context formatted for LLM input"""
        history = self.get_conversation_history(user_id, conversation_id)
        
        if not history:
            return ""
        
        context_lines = []
        for msg in history:
            if msg["role"] == "system":
                context_lines.append(msg["content"])
            else:
                role_label = "User" if msg["role"] == "user" else "Assistant"
                context_lines.append(f"{role_label}: {msg['content'][:200]}...")  # Truncate for readability
        
        return "\n\n".join(context_lines)
    
    async def summarize_old_turns(
        self,
        user_id: int,
        conversation_id: str,
        turn_range_start: int,
        turn_range_end: int,
    ) -> Optional[ConversationSummary]:
        """
        Summarize a range of turns using LLM to reduce token usage
        """
        try:
            # Fetch all turns in range
            turns = self.db.query(ConversationHistory).filter(
                and_(
                    ConversationHistory.user_id == user_id,
                    ConversationHistory.conversation_id == conversation_id,
                    ConversationHistory.turn_number >= turn_range_start,
                    ConversationHistory.turn_number <= turn_range_end,
                )
            ).order_by(ConversationHistory.turn_number).all()
            
            if not turns:
                print(f"⚠️ No turns found in range {turn_range_start}-{turn_range_end}")
                return None
            
            # Build conversation text
            conversation_text = ""
            original_tokens = 0
            for turn in turns:
                conversation_text += f"Q: {turn.user_message}\n\nA: {turn.assistant_response}\n\n---\n\n"
                original_tokens += turn.input_tokens + turn.output_tokens
            
            print(f"📊 Summarizing {len(turns)} turns ({original_tokens} tokens)...")
            
            # Call LLM to summarize
            summary_prompt = f"""Please provide a concise summary of the following conversation turns. 
Focus on key questions asked, important answers provided, and any decisions made.
Keep the summary brief but informative (2-3 paragraphs max).

CONVERSATION:
{conversation_text}

SUMMARY:"""
            
            summary_result = await self._call_llm_for_summary(summary_prompt)
            
            if not summary_result:
                print("❌ Failed to generate summary")
                return None
            
            # Extract key points
            key_points = self._extract_key_points(conversation_text, summary_result)
            
            # Save summary to database
            summary = ConversationSummary(
                user_id=user_id,
                conversation_id=conversation_id,
                turn_range_start=turn_range_start,
                turn_range_end=turn_range_end,
                num_original_turns=len(turns),
                summary=summary_result,
                key_points=key_points,
                original_input_tokens=original_tokens // 2,  # Rough estimate
                original_output_tokens=original_tokens // 2,
                summary_input_tokens=len(summary_prompt.split()),
                summary_output_tokens=len(summary_result.split()),
            )
            
            self.db.add(summary)
            
            # Mark original turns as summarized
            for turn in turns:
                turn.is_summarized = True
            
            self.db.commit()
            
            tokens_saved = original_tokens - (len(summary_prompt.split()) + len(summary_result.split()))
            print(f"✅ Summary created! Tokens saved: {tokens_saved} ({(tokens_saved/original_tokens*100):.1f}% reduction)")
            
            return summary
            
        except Exception as e:
            print(f"❌ Error summarizing turns: {e}")
            self.db.rollback()
            raise
    
    def _check_and_summarize_if_needed(
        self,
        user_id: int,
        conversation_id: str,
    ) -> bool:
        """
        Check if conversation needs summarization and trigger it if necessary
        Returns True if summarization was triggered
        """
        try:
            # Count unsummarized turns
            unsummarized_count = self.db.query(
                func.count(ConversationHistory.id)
            ).filter(
                and_(
                    ConversationHistory.user_id == user_id,
                    ConversationHistory.conversation_id == conversation_id,
                    ConversationHistory.is_summarized == False,
                )
            ).scalar() or 0
            
            # Calculate total tokens in active history
            total_tokens = self.db.query(
                func.sum(
                    ConversationHistory.input_tokens + ConversationHistory.output_tokens
                )
            ).filter(
                and_(
                    ConversationHistory.user_id == user_id,
                    ConversationHistory.conversation_id == conversation_id,
                    ConversationHistory.is_summarized == False,
                )
            ).scalar() or 0
            
            print(f"📈 Conversation check: {unsummarized_count} active turns, {total_tokens} tokens")
            
            # Trigger summarization if needed
            should_summarize = (
                unsummarized_count >= SUMMARY_TRIGGER_TURNS or
                total_tokens >= SUMMARY_TOKEN_THRESHOLD
            )
            
            if should_summarize:
                print(f"🔄 Summarization triggered (turns: {unsummarized_count}, tokens: {total_tokens})")
                
                # Find oldest turns to summarize
                oldest_turns = self.db.query(ConversationHistory).filter(
                    and_(
                        ConversationHistory.user_id == user_id,
                        ConversationHistory.conversation_id == conversation_id,
                        ConversationHistory.is_summarized == False,
                    )
                ).order_by(ConversationHistory.turn_number).limit(
                    SUMMARY_TRIGGER_TURNS - 5  # Keep last 5 unsummarized
                ).all()
                
                if oldest_turns:
                    start_turn = oldest_turns[0].turn_number
                    end_turn = oldest_turns[-1].turn_number
                    
                    # Run summarization asynchronously without blocking
                    # In production, consider using a task queue
                    asyncio.create_task(
                        self.summarize_old_turns(user_id, conversation_id, start_turn, end_turn)
                    )
                    return True
            
            return False
            
        except Exception as e:
            print(f"❌ Error checking summarization: {e}")
            return False
    
    async def _call_llm_for_summary(self, prompt: str) -> Optional[str]:
        """Call LLM to generate summary"""
        try:
            headers = {
                "Content-Type": "application/json",
                "api-key": API_KEY,
            }
            
            payload = {
                "messages": [
                    {"role": "system", "content": "You are an expert at creating concise, informative summaries of conversations."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.5,
                "max_tokens": 500,
            }
            
            url = f"{BASE_URL}/deployments/{FAISS_MODEL_NAME}/chat/completions?api-version={FAISS_API_VERSION}"
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                
                result = response.json()
                return result["choices"][0]["message"]["content"]
        
        except Exception as e:
            print(f"❌ LLM summary call failed: {e}")
            return None
    
    def _extract_key_points(self, conversation: str, summary: str) -> List[str]:
        """Extract key points from conversation and summary"""
        # Simple extraction - in production, could use NLP
        key_points = []
        
        sentences = summary.split(".")
        for sent in sentences[:3]:  # Take first 3 sentences as key points
            sent = sent.strip()
            if sent and len(sent) > 20:
                key_points.append(sent)
        
        return key_points
    
    def clear_old_conversations(
        self,
        user_id: int,
        days: int = 30,
    ) -> int:
        """Delete conversations older than N days"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Delete old conversations and their summaries
            old_conversations = self.db.query(ConversationHistory.conversation_id).filter(
                and_(
                    ConversationHistory.user_id == user_id,
                    ConversationHistory.created_at < cutoff_date,
                )
            ).distinct().all()
            
            conversation_ids = [c[0] for c in old_conversations]
            
            if conversation_ids:
                # Delete histories
                deleted = self.db.query(ConversationHistory).filter(
                    ConversationHistory.conversation_id.in_(conversation_ids)
                ).delete()
                
                # Delete summaries
                self.db.query(ConversationSummary).filter(
                    ConversationSummary.conversation_id.in_(conversation_ids)
                ).delete()
                
                self.db.commit()
                print(f"🗑️ Deleted {deleted} old turns from {len(conversation_ids)} conversations")
                return deleted
            
            return 0
            
        except Exception as e:
            print(f"❌ Error clearing old conversations: {e}")
            self.db.rollback()
            return 0
    
    def get_conversation_stats(
        self,
        user_id: int,
        conversation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get statistics about conversation usage and token costs"""
        try:
            if conversation_id:
                # Stats for single conversation
                unsummarized = self.db.query(ConversationHistory).filter(
                    and_(
                        ConversationHistory.user_id == user_id,
                        ConversationHistory.conversation_id == conversation_id,
                        ConversationHistory.is_summarized == False,
                    )
                ).count()
                
                summarized = self.db.query(ConversationHistory).filter(
                    and_(
                        ConversationHistory.user_id == user_id,
                        ConversationHistory.conversation_id == conversation_id,
                        ConversationHistory.is_summarized == True,
                    )
                ).count()
                
                total_tokens = self.db.query(
                    func.sum(
                        ConversationHistory.input_tokens + ConversationHistory.output_tokens
                    )
                ).filter(
                    and_(
                        ConversationHistory.user_id == user_id,
                        ConversationHistory.conversation_id == conversation_id,
                    )
                ).scalar() or 0
                
                summaries_count = self.db.query(ConversationSummary).filter(
                    and_(
                        ConversationSummary.user_id == user_id,
                        ConversationSummary.conversation_id == conversation_id,
                    )
                ).count()
                
                return {
                    "conversation_id": conversation_id,
                    "unsummarized_turns": unsummarized,
                    "summarized_turns": summarized,
                    "summary_segments": summaries_count,
                    "total_tokens": total_tokens,
                }
            else:
                # Stats for all conversations
                all_turns = self.db.query(ConversationHistory).filter(
                    ConversationHistory.user_id == user_id
                ).count()
                
                total_tokens = self.db.query(
                    func.sum(
                        ConversationHistory.input_tokens + ConversationHistory.output_tokens
                    )
                ).filter(
                    ConversationHistory.user_id == user_id
                ).scalar() or 0
                
                total_summaries = self.db.query(ConversationSummary).filter(
                    ConversationSummary.user_id == user_id
                ).count()
                
                return {
                    "total_turns": all_turns,
                    "total_tokens": total_tokens,
                    "total_summary_segments": total_summaries,
                    "estimated_cost_usd": (total_tokens / 1000000) * 0.001,  # Rough estimate
                }
        
        except Exception as e:
            print(f"❌ Error getting stats: {e}")
            return {}

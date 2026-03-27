from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Any
import uuid

from database import get_db
from db_models import ConversationHistory
from routers.auth import get_current_user
from db_models import User

router = APIRouter(prefix="/conversation", tags=["conversation"])

MAX_HISTORY_TURNS = 10  # Only keep last 10 Q&A pairs per conversation


class SaveTurnRequest(BaseModel):
    conversation_id: str
    user_message: str
    assistant_response: str
    context_type: str = "general"
    code_snippet: Optional[str] = None
    input_tokens: int = 0
    output_tokens: int = 0


class ConversationTurnResponse(BaseModel):
    id: int
    conversation_id: str
    turn_number: int
    user_message: str
    assistant_response: str
    context_type: str
    code_snippet: Optional[str]
    created_at: datetime
    # pdf_matches stored in summary_of_turns JSONB
    pdf_matches: Optional[List[Any]] = None

    class Config:
        from_attributes = True


class ConversationSessionResponse(BaseModel):
    conversation_id: str
    first_message: str
    last_message_at: datetime
    turn_count: int


@router.post("/save", response_model=ConversationTurnResponse)
def save_turn(
    payload: SaveTurnRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a single Q&A turn to conversation history."""
    existing_count = (
        db.query(ConversationHistory)
        .filter(
            ConversationHistory.user_id == current_user.id,
            ConversationHistory.conversation_id == payload.conversation_id,
        )
        .count()
    )

    turn = ConversationHistory(
        user_id=current_user.id,
        conversation_id=payload.conversation_id,
        turn_number=existing_count + 1,
        user_message=payload.user_message,
        assistant_response=payload.assistant_response,
        context_type=payload.context_type,
        code_snippet=payload.code_snippet,
        input_tokens=payload.input_tokens,
        output_tokens=payload.output_tokens,
    )
    db.add(turn)
    db.commit()
    db.refresh(turn)
    # Attach empty pdf_matches for response schema
    turn.pdf_matches = []
    return turn


@router.get("/history/{conversation_id}")
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all turns for a specific conversation (most recent MAX_HISTORY_TURNS)."""
    turns = (
        db.query(ConversationHistory)
        .filter(
            ConversationHistory.user_id == current_user.id,
            ConversationHistory.conversation_id == conversation_id,
        )
        .order_by(ConversationHistory.turn_number.asc())
        .all()
    )
    turns = turns[-MAX_HISTORY_TURNS:]

    result = []
    for t in turns:
        # Restore pdf_matches from summary_of_turns JSONB if present
        pdf_matches = []
        if t.summary_of_turns and isinstance(t.summary_of_turns, dict):
            pdf_matches = t.summary_of_turns.get("pdf_matches", [])
        result.append({
            "id": t.id,
            "conversation_id": t.conversation_id,
            "turn_number": t.turn_number,
            "user_message": t.user_message,
            "assistant_response": t.assistant_response,
            "context_type": t.context_type,
            "code_snippet": t.code_snippet,
            "created_at": t.created_at,
            "pdf_matches": pdf_matches,
        })
    return result


@router.get("/sessions", response_model=List[ConversationSessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all conversation sessions for the logged-in user (most recent 20)."""
    from sqlalchemy import func

    rows = (
        db.query(
            ConversationHistory.conversation_id,
            func.min(ConversationHistory.user_message).label("first_message"),
            func.max(ConversationHistory.created_at).label("last_message_at"),
            func.count(ConversationHistory.id).label("turn_count"),
        )
        .filter(ConversationHistory.user_id == current_user.id)
        .group_by(ConversationHistory.conversation_id)
        .order_by(func.max(ConversationHistory.created_at).desc())
        .limit(20)
        .all()
    )

    return [
        ConversationSessionResponse(
            conversation_id=row.conversation_id,
            first_message=row.first_message[:80] + "..." if len(row.first_message) > 80 else row.first_message,
            last_message_at=row.last_message_at,
            turn_count=row.turn_count,
        )
        for row in rows
    ]


@router.delete("/session/{conversation_id}")
def delete_session(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete all turns in a conversation session."""
    deleted = (
        db.query(ConversationHistory)
        .filter(
            ConversationHistory.user_id == current_user.id,
            ConversationHistory.conversation_id == conversation_id,
        )
        .delete()
    )
    db.commit()
    return {"deleted_turns": deleted, "conversation_id": conversation_id}

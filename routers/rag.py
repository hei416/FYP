from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import traceback
from datetime import datetime
from enum import Enum
import httpx
import json
import time
import asyncio
import random
import requests
import difflib
import re
from sqlalchemy import func
from database import SessionLocal
from db_models import QuizQuestion as QuizQuestionModel, PracticalTestHint as PracticalTestHintModel, SavedWork, Classroom, ClassroomMember
from fastapi import Depends
from sqlalchemy.orm import Session


from core.topic_mapping import SUBTOPIC_TO_MAIN_TOPIC, convert_topic_ids_to_main_topics
from services.classroom_rag import query_classroom_rag
from routers.auth import get_current_user
from database import get_db
from services.conversation_manager import ConversationManager
from services.rag_helpers import (
    build_pdf_matches_from_classroom_chunks,
    build_pdf_matches_from_docs,
    build_pdf_matches_from_langchain_docs,
    deduplicate_chunks,
    save_rag_conversation,
    clean_chunk_for_display
)

router = APIRouter()
# ==================== CLASSROOM-SCOPED RAG ENDPOINT ====================

class ClassroomRAGRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None
    user_id: Optional[int] = None

@router.post("/classroom/{classroom_id}/ask")
async def ask_classroom_rag(
    classroom_id: int,
    request: ClassroomRAGRequest,
    http_request: Request,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    membership = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id,
        ClassroomMember.student_id == current_user.id
    ).first()
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not membership and not (classroom and (
        current_user.role == "admin" or classroom.teacher_id == current_user.id
    )):
        raise HTTPException(403, "You are not enrolled in this classroom")

    # Debug: Check chunk count in database
    from db_models import ClassroomChunk
    chunk_count = db.query(ClassroomChunk).filter(ClassroomChunk.classroom_id == classroom_id).count()
    print(f"📊 Classroom {classroom_id}: {chunk_count} chunks in database")
    
    docs = query_classroom_rag(classroom_id, request.question)
    print(f"📊 Query returned {len(docs)} documents")
    
    if not docs:
        return {"answer": "No documents have been uploaded to this classroom yet.", "has_context": False, "sources_count": 0}

    context = "\n\n".join(d.get("page_content", "") for d in docs)
    chain = await get_rag_chain()
    answer = chain(f"Context from classroom materials:\n{context}\n\nQuestion: {request.question}")
    
    # Get the base URL for absolute iframe URLs
    base_url = str(http_request.base_url).rstrip('/')
    
    # Build PDF matches using helper
    pdf_matches = build_pdf_matches_from_docs(
        docs=docs,
        base_url=base_url,
        classroom_id=classroom_id,
        clean_display=True,
        max_matches=3
    )
    
    # Save conversation if user_id is provided
    if current_user and current_user.id:
        conversation_manager = ConversationManager()
        user_id = current_user.id
        if not request.conversation_id:
            request.conversation_id = conversation_manager.create_conversation_id(user_id)
            print(f"📌 Created new classroom conversation: {request.conversation_id}")
        
        save_rag_conversation(
            conversation_manager=conversation_manager,
            user_id=user_id,
            conversation_id=request.conversation_id,
            user_message=request.question,
            assistant_response=answer,
            context_type="classroom_rag",
            pdf_matches=pdf_matches,
            code_snippet=None
        )
    
    return {
        "answer": answer,
        "conversation_id": request.conversation_id,
        "has_context": True,
        "sources_count": len(docs),
        "debug_log": {
            "pdf_matches": pdf_matches,
        }
    }


# Global variables
rag_chain = None
retriever = None


@router.get("/api/rag/status")
async def rag_status():
    """Return whether the RAG system is initialized (for frontend warm-up banner)."""
    from main import RAG_INITIALIZED
    return {"ready": RAG_INITIALIZED}


def require_rag_rebuild_access(current_user):
    if current_user.role not in {"teacher", "admin"}:
        raise HTTPException(status_code=403, detail="Only teachers or admins can rebuild the knowledge base")


@router.post("/api/rag/rebuild/platform-guide")
async def rebuild_platform_guide_rag(current_user=Depends(get_current_user)):
    require_rag_rebuild_access(current_user)
    from main import ensure_rag_initialized
    import routers.lessons as lessons_router

    await ensure_rag_initialized(rebuild_platform=True)
    lessons_router.load_vectorstore.cache_clear()
    return {"success": True, "rebuilt": "platform_guide"}


@router.post("/api/rag/rebuild/java-knowledge")
async def rebuild_java_knowledge_rag(current_user=Depends(get_current_user)):
    require_rag_rebuild_access(current_user)
    from main import ensure_rag_initialized
    import routers.lessons as lessons_router

    await ensure_rag_initialized(rebuild_java=True)
    lessons_router.load_vectorstore.cache_clear()
    return {"success": True, "rebuilt": "java_knowledge"}


@router.post("/api/rag/rebuild/all")
async def rebuild_all_rag(current_user=Depends(get_current_user)):
    require_rag_rebuild_access(current_user)
    from main import ensure_rag_initialized
    import routers.lessons as lessons_router

    await ensure_rag_initialized(rebuild_java=True, rebuild_platform=True)
    lessons_router.load_vectorstore.cache_clear()
    return {"success": True, "rebuilt": "all"}


async def get_retriever():
    """Single source of truth for retriever access across all endpoints."""
    global retriever
    from main import ensure_rag_initialized
    await ensure_rag_initialized()
    if retriever is None:
        raise HTTPException(status_code=503, detail="RAG system unavailable")
    return retriever

async def get_rag_chain():
    """Single source of truth for rag_chain access."""
    global rag_chain
    from main import ensure_rag_initialized
    await ensure_rag_initialized()
    if rag_chain is None:
        raise HTTPException(status_code=503, detail="RAG chain unavailable")
    return rag_chain

class ExplainRequest(BaseModel):
    user_input: str
    code_snippet: str = ""
    history: List[Dict[str, Any]] = []
    user_id: Optional[int] = None
    conversation_id: Optional[str] = None

class DocumentRequest(BaseModel):
    source_file: str

class CodeReviewRequest(BaseModel):
    code: str
    question_context: str = ""
    language: str = "java"

class HintLevel(str, Enum):
    GENTLE = "gentle"
    SPECIFIC = "specific"
    DETAILED = "detailed"

class HintRequest(BaseModel):
    problem_description: str
    student_code: str
    test_cases_failed: List[str] = []
    expected_output: str = ""
    actual_output: str = ""
    hint_level: HintLevel = HintLevel.GENTLE
    previous_hints: List[str] = []

class GradingRequest(BaseModel):
    problem_description: str
    expected_approach: str
    student_code: str
    test_results: Dict[str, List[str]]
    expected_outputs: List[str] = []
    actual_outputs: List[str] = []

class GradingResponse(BaseModel):
    total_score: float
    breakdown: Dict[str, float]
    grade_letter: str
    feedback: str
    suggestions: List[str]
    partial_credit_reasoning: str
    code_quality_notes: str
    metadata: Dict[str, Any]


class QuizGenerateRequest(BaseModel):
    completed_topics: List[str]
    num_questions: int = 10
    user_id: Optional[int] = None
    course: Optional[str] = "basic"  # "basic" | "enhanced"

class MCQ(BaseModel):
    id: str
    topic_id: str
    question: str
    options: List[str]
    correct_index: int
    explanation: str

class QuizGenerateResponse(BaseModel):
    questions: List[MCQ]
    metadata: Dict[str, Any]


# ==================== DB HELPERS ====================

def get_questions_from_db(topic_ids: List[str], user_id: Optional[int] = None) -> List[dict]:
    """Fetch all stored questions for the given topics.

    If `user_id` is provided, exclude questions the user has already
    answered correctly (retired) as recorded in `SavedWork`.
    """
    try:
        if not topic_ids:
            print(f"⚠️ No topics provided to get_questions_from_db")
            return []

        main_topics = convert_topic_ids_to_main_topics(topic_ids)
        print(f"📍 Converting topic IDs: {topic_ids} → {main_topics}")

        db = SessionLocal()
        try:
            rows = db.query(QuizQuestionModel).filter(
                QuizQuestionModel.topic_id.in_(main_topics)
            ).all()
            print(f"🔍 DB query for topics {main_topics}: found {len(rows)} questions")

            questions = [
                {
                    "id": row.id,
                    "topic_id": row.topic_id,
                    "question": row.question,
                    "options": row.options,
                    "correct_index": row.correct_index,
                    "explanation": row.explanation,
                }
                for row in rows
            ]

            # If user_id provided, exclude any retired (passed) questions
            if user_id:
                retired_ids = set()
                try:
                    sw_rows = db.query(SavedWork).filter(
                        SavedWork.user_id == user_id,
                        SavedWork.work_type == 'quiz'
                    ).all()
                    for row in sw_rows:
                        raw = row.result_data
                        review = []
                        # result_data may be stored as a JSON string or as a dict
                        try:
                            if isinstance(raw, str):
                                parsed = json.loads(raw) if raw.strip() else {}
                                review = parsed.get('review', []) if isinstance(parsed, dict) else []
                            elif isinstance(raw, dict):
                                review = raw.get('review', [])
                        except Exception as parse_e:
                            print(f"⚠️ Failed to parse SavedWork.result_data for user {user_id}: {parse_e}")

                        for item in (review or []):
                            try:
                                if item.get('is_correct'):
                                    qid = item.get('question_id')
                                    if qid is not None:
                                        retired_ids.add(str(qid))
                            except Exception:
                                continue
                except Exception as e:
                    print(f"⚠️ Failed to read SavedWork for user {user_id}: {e}")

                if retired_ids:
                    before = len(questions)
                    # Normalize comparison by converting stored question ids to strings
                    questions = [q for q in questions if str(q['id']) not in retired_ids]
                    print(f"🚫 Excluded {before - len(questions)} retired questions for user {user_id}")

            return questions
        finally:
            db.close()
    except Exception as e:
        print(f"🔴 DB read error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return []


def save_questions_to_db(questions: List[dict]):
    """Insert new questions into the DB, skipping duplicates."""
    try:
        if not questions:
            print(f"⚠️ No questions to save")
            return

        db = SessionLocal()
        try:
            inserted_count = 0
            existing_ids = {
                row.id for row in db.query(QuizQuestionModel.id).filter(
                    QuizQuestionModel.id.in_([q["id"] for q in questions])
                ).all()
            }
            for q in questions:
                if q["id"] not in existing_ids:
                    db.add(QuizQuestionModel(
                        id=q["id"],
                        topic_id=q["topic_id"],
                        question=q["question"],
                        options=q["options"],
                        correct_index=q["correct_index"],
                        explanation=q["explanation"],
                    ))
                    inserted_count += 1
            db.commit()
            print(f"✅ Saved {inserted_count} new questions to DB (attempted {len(questions)})")
        finally:
            db.close()
    except Exception as e:
        print(f"🔴 DB save error: {type(e).__name__}: {e}")
        traceback.print_exc()


def count_questions_by_topic(topic_ids: List[str]) -> Dict[str, int]:
    """Count stored questions per topic."""
    try:
        if not topic_ids:
            return {}

        main_topics = convert_topic_ids_to_main_topics(topic_ids)

        db = SessionLocal()
        try:
            rows = (
                db.query(QuizQuestionModel.topic_id, func.count(QuizQuestionModel.id).label("cnt"))
                .filter(QuizQuestionModel.topic_id.in_(main_topics))
                .group_by(QuizQuestionModel.topic_id)
                .all()
            )
            return {row.topic_id: row.cnt for row in rows}
        finally:
            db.close()
    except Exception as e:
        print(f"🔴 DB count error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return {}


def sample_questions_with_topic_coverage(
    questions: List[dict],
    num_questions: int,
    main_topics: List[str]
) -> List[dict]:
    num_topics = len(main_topics)
    actual_num = max(num_questions, num_topics)

    if actual_num > num_questions:
        print(f"📈 Adjusting num_questions from {num_questions} to {actual_num} (one per topic)")

    questions_by_topic = {}
    for q in questions:
        topic = q["topic_id"]
        if topic not in questions_by_topic:
            questions_by_topic[topic] = []
        questions_by_topic[topic].append(q)

    selected = []
    selected_ids = set()

    for topic in main_topics:
        if topic in questions_by_topic and questions_by_topic[topic]:
            q = random.choice(questions_by_topic[topic])
            selected.append(q)
            selected_ids.add(q["id"])

    remaining_needed = actual_num - len(selected)
    if remaining_needed > 0:
        available_pool = [q for q in questions if q["id"] not in selected_ids]
        if available_pool:
            additional = random.sample(
                available_pool,
                min(remaining_needed, len(available_pool))
            )
            selected.extend(additional)

    random.shuffle(selected)
    return selected[:actual_num]


# ==================== QUIZ ENDPOINTS ====================

@router.post("/api/quizzes/generate", response_model=QuizGenerateResponse)
async def generate_mcq_quiz(req: QuizGenerateRequest):
    """Serve quiz from DB (random pick). If not enough questions exist, auto-generate via AI."""
    print(f"📥 Quiz request: {req.completed_topics}, num={req.num_questions}")
    print(f"📥 user_id received: {req.user_id}")

    try:
        main_topics = convert_topic_ids_to_main_topics(req.completed_topics)
        print(f"📍 Main topics: {main_topics}")

        adjusted_num = max(req.num_questions, len(main_topics))
        if adjusted_num > req.num_questions:
            print(f"📈 Adjusted num_questions: {req.num_questions} → {adjusted_num} (one per topic)")

        db_questions = get_questions_from_db(req.completed_topics, req.user_id)
        print(f"💾 DB has {len(db_questions)} questions for these topics (after user retire filter)")

        if len(db_questions) >= adjusted_num:
            sampled = sample_questions_with_topic_coverage(db_questions, adjusted_num, main_topics)
            mcq_list = [MCQ(**q) for q in sampled]
            print(f"✅ Served {len(mcq_list)} from DB (pool: {len(db_questions)})")
            return QuizGenerateResponse(
                questions=mcq_list,
                metadata={
                    "source": "database",
                    "pool_size": len(db_questions),
                    "served": len(mcq_list),
                    "topics_covered": list(set(q.topic_id for q in mcq_list)),
                }
            )

        print(f"🤖 Need more questions. DB has {len(db_questions)}, need {adjusted_num}. Generating...")
        new_questions = await _generate_new_questions(
            topics=req.completed_topics,
            num_questions=adjusted_num,
            existing_questions=db_questions,
            course=req.course or "basic",
        )

        save_questions_to_db(new_questions)

        all_questions = db_questions + new_questions
        sampled = sample_questions_with_topic_coverage(all_questions, adjusted_num, main_topics)
        mcq_list = [MCQ(**q) for q in sampled]

        return QuizGenerateResponse(
            questions=mcq_list,
            metadata={
                "source": "ai_generated",
                "new_generated": len(new_questions),
                "pool_size": len(all_questions),
                "served": len(mcq_list),
                "topics_covered": list(set(q.topic_id for q in mcq_list)),
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"🔴 EXCEPTION: {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)}")


@router.post("/api/quizzes/more")
async def stream_more_questions(req: QuizGenerateRequest):
    """Stream NEW questions via SSE, one at a time as they are generated."""
    print(f"📥 'More Questions' SSE request: {req.completed_topics}, num={req.num_questions}")
    print(f"📥 user_id received: {req.user_id}")

    # ✅ lazy-init RAG before entering the streaming generator
    ret = await get_retriever()

    existing = get_questions_from_db(req.completed_topics, req.user_id)
    print(f"💾 DB has {len(existing)} existing questions to avoid (after user retire filter)")

    topics = req.completed_topics
    num_topics = len(topics)
    if num_topics <= 3:
        max_docs, max_chars = 2, 800
    elif num_topics <= 6:
        max_docs, max_chars = 2, 500
    else:
        max_docs, max_chars = 1, 400

    async def retrieve_topic(topic_id: str):
        try:
            docs = await asyncio.to_thread(ret.invoke, topic_id)
            combined = "\n\n".join([d.page_content[:max_chars] for d in docs[:max_docs]])
            if combined:
                return f"Topic ID: {topic_id}\n{combined}"
        except Exception as e:
            print(f"  ⚠️ Retriever failed for {topic_id}: {e}")
        return None

    results = await asyncio.gather(*[retrieve_topic(t) for t in topics])
    topic_contexts = [r for r in results if r is not None]

    if not topic_contexts:
        raise HTTPException(status_code=400, detail="No content found for topics")

    context_text = "\n\n---\n\n".join(topic_contexts)

    async def event_generator():
        all_existing = list(existing)
        num_to_generate = req.num_questions

        for i in range(num_to_generate):
            try:
                question = await _generate_single_question(
                    context_text=context_text,
                    existing_questions=all_existing,
                    question_index=i,
                    course=req.course or "basic",
                )
                if question:
                    save_questions_to_db([question])
                    all_existing.append(question)
                    yield f"data: {json.dumps(question)}\n\n"
                    print(f"  ✅ Streamed question {i+1}/{num_to_generate}")
            except Exception as e:
                print(f"  ❌ Failed to generate question {i+1}: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        total_pool = len(get_questions_from_db(req.completed_topics, req.user_id))
        yield f"data: {json.dumps({'done': True, 'total_pool': total_pool})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


class TopicContentRequest(BaseModel):
    topic_id: str
    topic_name: str


# ==================== TOPIC CONTENT GENERATION ====================

@router.post("/api/topics/generate-content")
async def generate_topic_content(req: TopicContentRequest):
    """Generate learning material for a topic using RAG + LLM."""
    try:
        # ✅ lazy-init
        ret = await get_retriever()

        print(f"📚 Generating content for topic: {req.topic_name}")
        start_time = datetime.now()

        docs = await asyncio.to_thread(ret.invoke, req.topic_name)
        context_snippets = "\n\n".join([d.page_content[:600] for d in docs[:3]])

        if not context_snippets:
            raise HTTPException(status_code=400, detail=f"No content found for topic: {req.topic_name}")

        prompt = f"""You are an expert Java tutor creating comprehensive learning material.

TOPIC: {req.topic_name}

Using ONLY the following Java documentation and examples, create detailed learning material:

{context_snippets}

Generate a JSON object with this exact structure:
{{
  "title": "Clear topic title",
  "overview": "2-3 sentence overview of what students will learn",
  "keyConceptsHtml": "<div class='concept'><h3>1. Concept Name</h3><p>Explanation...</p><pre><code>// Java code example</code></pre></div><div class='concept'><h3>2. Another Concept</h3><p>More explanation...</p></div>",
  "codeExamples": [
    {{
      "title": "Example 1 Title",
      "java": "// Complete Java code example\\nint x = 10;"
    }},
    {{
      "title": "Example 2 Title",
      "java": "// Another Java example\\nString name = \\"Alice\\";"
    }},
    {{
      "title": "Example 3 Title",
      "java": "// Third example showing real usage"
    }}
  ],
  "keyTakeaways": [
    "First important concept to remember",
    "Second key point",
    "Third important takeaway",
    "Fourth learning point",
    "Fifth key concept",
    "Sixth related concept"
  ]
}}

IMPORTANT:
- Include ONLY Java code examples (no Python, no comparisons)
- Use HTML with <div class='concept'> for structured content
- Include 3+ code examples showing practical usage
- Write 6 key takeaways
- Keep language clear and educational
- Focus on practical Java concepts students will use"""

        content_result = await call_llm_json(
            messages=[
                {"role": "system", "content": "You are an expert Java instructor. Create comprehensive learning material. Respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2500,
            timeout=60
        )

        elapsed = (datetime.now() - start_time).total_seconds()

        return {
            "topic_id": req.topic_id,
            "content": content_result,
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "generation_time_sec": round(elapsed, 2),
                "model": "qwen3-max",
                "retrieval_docs": len(docs),
                "content_source": "RAG + LLM"
            }
        }

    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse LLM JSON: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse generated content: {str(e)}")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Content generation error: {str(e)}")


@router.post("/api/topics/batch-generate")
async def batch_generate_topic_content(topics: List[TopicContentRequest]):
    """Generate learning material for multiple topics in parallel."""
    try:
        print(f"📚 Batch generating content for {len(topics)} topics")
        tasks = [generate_topic_content(topic) for topic in topics]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        successful = [r for r in results if isinstance(r, dict) and "content" in r]
        failed = [str(r) for r in results if isinstance(r, Exception)]
        return {
            "total_requested": len(topics),
            "successful": len(successful),
            "failed": len(failed),
            "contents": successful,
            "errors": failed
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Batch generation error: {str(e)}")


# ==================== AI GENERATION HELPER ====================

async def _generate_new_questions(
    topics: List[str],
    num_questions: int,
    existing_questions: List[dict],
    course: str = "basic",
) -> List[dict]:
    """Call AI to generate new unique questions, avoiding duplicates."""
    # ✅ lazy-init
    ret = await get_retriever()

    main_topics = convert_topic_ids_to_main_topics(topics)
    print(f"📍 Converting topics for generation: {topics} → {main_topics}")

    retrieval_start = time.time()
    num_topics = len(main_topics)

    if num_topics <= 3:
        max_docs, max_chars = 2, 800
    elif num_topics <= 6:
        max_docs, max_chars = 2, 500
    else:
        max_docs, max_chars = 1, 400

    async def retrieve_topic(topic_id: str):
        try:
            docs = await asyncio.to_thread(ret.invoke, topic_id)
            combined = "\n\n".join([d.page_content[:max_chars] for d in docs[:max_docs]])
            if combined:
                return f"Topic ID: {topic_id}\n{combined}"
        except Exception as e:
            print(f"  ⚠️ Retriever failed for {topic_id}: {e}")
        return None

    results = await asyncio.gather(*[retrieve_topic(t) for t in main_topics])
    topic_contexts = [r for r in results if r is not None]
    print(f"⏱️ Retrieval: {time.time() - retrieval_start:.2f}s ({num_topics} topics)")

    if not topic_contexts:
        raise HTTPException(status_code=400, detail="No content found for topics")

    context_text = "\n\n---\n\n".join(topic_contexts)

    exclusion_block = ""
    if existing_questions:
        existing_texts = [q["question"] for q in existing_questions[-20:]]
        exclusion_block = "\n\nDo NOT repeat any of these existing questions:\n" + "\n".join(
            f"- {q}" for q in existing_texts
        )

    id_prefix = f"q{int(time.time())}_"

    if course == "enhanced":
        difficulty_instruction = (
            "DIFFICULTY — ADVANCED LEVEL:\n"
            "- Questions must require deep understanding, not surface recall\n"
            "- Favour: code output prediction with edge cases, design trade-off reasoning, "
            "performance/complexity implications, multi-concept interactions (e.g. generics + collections), "
            "subtle pitfalls (thread-safety, hash contract violations, stream side-effects)\n"
            "- Avoid trivial definition questions; every question should challenge an experienced Java developer\n"
        )
    else:
        difficulty_instruction = (
            "DIFFICULTY — BEGINNER/INTERMEDIATE LEVEL:\n"
            "- Questions should test fundamental Java knowledge\n"
            "- Favour: syntax rules, basic OOP concepts, simple code reading, common API usage\n"
            "- Avoid complex multi-concept questions; focus on clear, unambiguous scenarios\n"
        )

    prompt = f"""You are a Java tutor generating multiple-choice questions to test Java programming knowledge.

The following study material covers these Java topics. Use it ONLY to understand what concepts to test — do NOT ask questions about the material itself:

{context_text}

{difficulty_instruction}
Generate exactly {num_questions} NEW and UNIQUE multiple-choice questions.
Distribute questions EVENLY across these topic IDs: {main_topics}

Each question MUST:
- Test Java programming knowledge and skills directly (syntax, output, logic, best practices)
- Be answerable by anyone who knows Java — NOT by someone who read a specific document
- Have 4 options with EXACTLY one correct answer
- Use IDs starting with "{id_prefix}" (e.g. "{id_prefix}1", "{id_prefix}2", ...)
- Cover a DIFFERENT concept or aspect — no two questions should test the same thing

FORBIDDEN:
- Do NOT use phrases like "According to the material", "As stated in", "Based on the reading"
- Do NOT ask about W3Schools, tutorials, or any learning resource
- Do NOT generate multiple questions about the same concept (e.g. no 3 questions all about import syntax)
{exclusion_block}

Respond as a JSON object with this schema:
{{
    "questions": [
        {{
            "id": "{id_prefix}1",
            "topic_id": "topic id from above",
            "question": "Question text...",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_index": 1,
            "explanation": "Why this option is correct"
        }}
    ]
}}"""

    print("🤖 Calling LLM...")
    start_time = datetime.now()

    llm_result = await call_llm_json(
        messages=[
            {"role": "system", "content": "You are an expert Java instructor. Respond with valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.5,
        max_tokens=2000,
        timeout=90
    )

    raw_questions = llm_result.get("questions", [])
    elapsed = (datetime.now() - start_time).total_seconds()
    print(f"✅ LLM returned {len(raw_questions)} questions in {elapsed:.1f}s")

    if not raw_questions:
        raise HTTPException(status_code=500, detail="LLM returned no questions")

    try:
        [MCQ(**q) for q in raw_questions]
    except Exception as e:
        print(f"❌ LLM format invalid: {e}")
        raise HTTPException(status_code=500, detail=f"LLM format error: {e}")

    return raw_questions


async def _generate_single_question(
    context_text: str,
    existing_questions: List[dict],
    question_index: int,
    course: str = "basic",
) -> Optional[dict]:
    """Generate exactly ONE new question via a fast LLM call."""
    exclusion_block = ""
    if existing_questions:
        existing_texts = [q["question"] for q in existing_questions[-15:]]
        exclusion_block = "\n\nDo NOT repeat any of these existing questions:\n" + "\n".join(
            f"- {q}" for q in existing_texts
        )

    id_prefix = f"q{int(time.time())}_{question_index}"

    if course == "enhanced":
        difficulty_instruction = (
            "DIFFICULTY — ADVANCED: Require deep understanding. "
            "Favour edge-case output prediction, design trade-offs, performance/complexity implications, "
            "subtle pitfalls (e.g. thread-safety, hash contract, stream reuse). "
            "Avoid trivial recall questions."
        )
    else:
        difficulty_instruction = (
            "DIFFICULTY — BEGINNER/INTERMEDIATE: Test fundamental Java knowledge. "
            "Favour syntax rules, basic OOP, simple code reading, and common API usage."
        )

    prompt = f"""You are a Java tutor. Generate exactly 1 multiple-choice question to test Java programming knowledge.

Use this study material ONLY to understand what concept to test — do NOT reference it in the question:

{context_text}

{difficulty_instruction}

The question MUST:
- Test Java syntax, behaviour, output prediction, or best practices
- Be answerable from Java knowledge alone — not from reading any specific document
- Have 4 options with EXACTLY one correct answer
- NOT use phrases like "According to the material" or "As mentioned in"
- Test a DIFFERENT concept from these already-asked questions:
{exclusion_block}

Respond as a JSON object:
{{
    "id": "{id_prefix}",
    "topic_id": "the topic id from the material above",
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "correct_index": 0,
    "explanation": "Why correct"
}}"""

    result = await call_llm_json(
        messages=[
            {"role": "system", "content": "You are an expert Java instructor. Respond with valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.6,
        max_tokens=500,
        timeout=30
    )

    if "questions" in result and isinstance(result["questions"], list):
        q = result["questions"][0]
    else:
        q = result

    MCQ(**q)
    return q


# ==================== LLM HELPERS ====================

def get_api_config():
    from core.config import API_KEY, BASE_URL, FAISS_MODEL_NAME, FAISS_API_VERSION
    return {
        "url": f"{BASE_URL}/deployments/{FAISS_MODEL_NAME}/chat/completions?api-version={FAISS_API_VERSION}",
        "headers": {
            "Content-Type": "application/json",
            "api-key": API_KEY
        }
    }

async def call_llm(messages: List[Dict], temperature: float = 0.7, max_tokens: int = 1000, timeout: int = 90):
    config = get_api_config()
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            config["url"],
            headers=config["headers"],
            json={"messages": messages, "temperature": temperature, "max_tokens": max_tokens},
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

async def call_llm_json(messages: List[Dict], temperature: float = 0.3, max_tokens: int = 1500, timeout: int = 90):
    config = get_api_config()
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            config["url"],
            headers=config["headers"],
            json={
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"}
            },
        )
        response.raise_for_status()
        result = response.json()["choices"][0]["message"]["content"]
        result = result.replace("```json", "").replace("```", "").strip()
        return json.loads(result)


# ==================== RAG ====================

@router.post("/ragAI")
async def rag_ai(req: ExplainRequest):
    try:
        global rag_chain, retriever

        from main import ensure_rag_initialized
        await ensure_rag_initialized()

        if rag_chain is None or retriever is None:
            raise HTTPException(status_code=500, detail="RAG system failed to initialize")

        query = req.user_input.strip()
        if req.code_snippet:
            query = f"{query}\n\nCode:\n{req.code_snippet}"
        if not query:
            raise HTTPException(status_code=400, detail="Query cannot be empty")

        print(f"[RAG] Processing: {query[:50]}...")
        start_time = datetime.now()

        conversation_manager = None
        if req.user_id:
            conversation_manager = ConversationManager()
            if not req.conversation_id:
                req.conversation_id = conversation_manager.create_conversation_id(req.user_id)
                print(f"📌 Created new conversation: {req.conversation_id}")
            conv_context = conversation_manager.get_context_for_llm(req.user_id, req.conversation_id)
            if conv_context:
                query = f"Previous conversation context:\n{conv_context}\n\n---\n\nNew question:\n{query}"
                print(f"📚 Added {len(conv_context)} chars of conversation context")

        final_answer = rag_chain(query)
        docs = retriever.invoke(query)
        
        # Build PDF matches using helper
        pdf_matches = build_pdf_matches_from_langchain_docs(
            docs=docs,
            extract_url_from_content=True,
            max_matches=3
        )
        elapsed = (datetime.now() - start_time).total_seconds()

        if conversation_manager and req.user_id and req.conversation_id:
            save_rag_conversation(
                conversation_manager=conversation_manager,
                user_id=req.user_id,
                conversation_id=req.conversation_id,
                user_message=req.user_input,
                assistant_response=final_answer,
                context_type="explain",
                pdf_matches=pdf_matches,
                code_snippet=req.code_snippet if req.code_snippet else None,
                input_tokens=len(query.split()),
                output_tokens=len(final_answer.split())
            )

        return {
            "final_answer": final_answer,
            "conversation_id": req.conversation_id,
            "debug_log": {
                "query": query[:100],
                "timestamp": datetime.now().isoformat(),
                "model": "qwen3-max (FAISS)",
                "response_time_sec": round(elapsed, 2),
                "nli_faithfulness": "97.62%",
                "semantic_similarity": "80.78%",
                "pdf_matches": pdf_matches,
                "retrieval_method": "MMR"
            }
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"RAG error: {str(e)}")


# ==================== CODE REVIEW ====================

@router.post("/api/review-code")
async def review_code(req: CodeReviewRequest):
    try:
        review_prompt = f"""You are a Java programming tutor. Review the following student code and provide constructive feedback.

Question/Requirements:
{req.question_context if req.question_context else 'General code review'}

Student Code:
{req.code}

Please provide:
1. Code Quality: Comment on structure, naming, readability
2. Best Practices: Identify violations of Java best practices
3. Potential Issues: Point out bugs, edge cases, logical errors
4. Suggestions: Offer specific improvements with examples
5. Positive Feedback: Highlight what the student did well

Keep feedback constructive and educational."""

        print(f"[Code Review] Analyzing {len(req.code)} chars...")
        start_time = datetime.now()
        review = await call_llm(
            messages=[{"role": "user", "content": review_prompt}],
            temperature=0.7, max_tokens=1000, timeout=90
        )
        elapsed = (datetime.now() - start_time).total_seconds()
        return {
            "review": review,
            "references": [],
            "metadata": {
                "code_length": len(req.code),
                "language": req.language,
                "review_time_sec": round(elapsed, 2),
                "timestamp": datetime.now().isoformat()
            }
        }
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Review timed out")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Code review error: {str(e)}")


# ==================== HINTS ====================

@router.post("/api/hints/generate")
async def generate_progressive_hint(req: HintRequest):
    try:
        ret = await get_retriever()
        print(f"[Hints] Generating {req.hint_level} hint...")
        start_time = datetime.now()

        # Normalize problem description to a lightweight cache key
        question_key = (req.problem_description or "").strip().lower()[:900]

        # Check DB cache first
        try:
            db = SessionLocal()
            cached = db.query(PracticalTestHintModel).filter(
                PracticalTestHintModel.question_key == question_key,
                PracticalTestHintModel.hint_level == req.hint_level.value,
            ).first()
            if cached:
                elapsed = (datetime.now() - start_time).total_seconds()
                print(f"💾 Served cached hint (level={req.hint_level.value}) for key[{question_key[:80]}]")
                return {
                    "hint": cached.content,
                    "hint_level": req.hint_level.value,
                    "can_request_more": req.hint_level != HintLevel.DETAILED,
                    "next_level": (
                        HintLevel.SPECIFIC.value if req.hint_level == HintLevel.GENTLE
                        else HintLevel.DETAILED.value if req.hint_level == HintLevel.SPECIFIC
                        else None
                    ),
                    "sources": [],
                    "metadata": {
                        "response_time_sec": round(elapsed, 2),
                        "timestamp": datetime.now().isoformat(),
                        "model": "cache",
                        "retrieval_docs": 0,
                        "cached": True,
                    },
                }
        finally:
            try:
                db.close()
            except Exception:
                pass

        relevant_docs = ret.invoke(f"Java {req.problem_description}")
        context_snippets = "\n\n".join([
            f"Reference {i+1}:\n{doc.page_content[:500]}"
            for i, doc in enumerate(relevant_docs[:2])
        ])

        prompts = {
            HintLevel.GENTLE: f"""You are a patient Java tutor providing a GENTLE hint (Level 1).

Problem: {req.problem_description}
Student's Code:
{req.student_code}
Test Cases Failed: {', '.join(req.test_cases_failed) if req.test_cases_failed else 'Not specified'}
Relevant Java Concepts:
{context_snippets}

Guidelines:
- Give a HIGH-LEVEL hint about the general approach or concept
- DO NOT mention specific code or method names
- Keep it under 2 sentences
- Be encouraging

Generate a gentle hint now:""",

            HintLevel.SPECIFIC: f"""You are a Java tutor providing a SPECIFIC hint (Level 2).

Problem: {req.problem_description}
Student's Code:
{req.student_code}
Test Cases Failed: {', '.join(req.test_cases_failed)}
Expected: {req.expected_output}
Actual: {req.actual_output}
Previous Hints:
{chr(10).join(f"- {h}" for h in req.previous_hints)}
Relevant Java Concepts:
{context_snippets}

Guidelines:
- Point to the SPECIFIC issue in their code
- You can mention Java classes/methods
- Explain WHY their approach fails
- Don't write the complete code
- Keep it under 3 sentences

Generate a specific hint now:""",

            HintLevel.DETAILED: f"""You are a Java tutor providing a DETAILED hint (Level 3).

Problem: {req.problem_description}
Student's Code:
{req.student_code}
Test Cases Failed: {', '.join(req.test_cases_failed)}
Expected: {req.expected_output}
Actual: {req.actual_output}
Previous Hints:
{chr(10).join(f"- {h}" for h in req.previous_hints)}
Relevant Java Concepts:
{context_snippets}

Guidelines:
- Provide PSEUDOCODE or KEY CODE SNIPPET
- Explain step-by-step what to do
- They still need to integrate it themselves
- Keep it under 5 sentences

Generate a detailed hint now:"""
        }

        hint_text = await call_llm(
            messages=[
                {"role": "system", "content": "You are an expert Java tutor who provides progressive hints."},
                {"role": "user", "content": prompts[req.hint_level]}
            ],
            temperature=0.7, max_tokens=300, timeout=30
        )
        elapsed = (datetime.now() - start_time).total_seconds()
        pdf_matches = [
            {
                "file": doc.metadata.get('source', 'Unknown').split('/')[-1],
                "snippet": doc.page_content[:200],
                "relevance": "Used for hint generation"
            }
            for doc in relevant_docs[:2]
        ]
        # Save hint to DB cache for future requests
        try:
            db = SessionLocal()
            try:
                new_hint = PracticalTestHintModel(
                    question_key=question_key,
                    hint_level=req.hint_level.value,
                    content=hint_text,
                )
                db.add(new_hint)
                db.commit()
                print(f"💾 Saved hint (level={req.hint_level.value}) to DB for key[{question_key[:80]}]")
            except Exception as e:
                db.rollback()
                print(f"⚠️ Failed to save hint cache: {e}")
        except Exception as e:
            print(f"⚠️ DB connection error when saving hint: {e}")
        finally:
            try:
                db.close()
            except Exception:
                pass

        return {
            "hint": hint_text,
            "hint_level": req.hint_level.value,
            "can_request_more": req.hint_level != HintLevel.DETAILED,
            "next_level": (
                HintLevel.SPECIFIC.value if req.hint_level == HintLevel.GENTLE
                else HintLevel.DETAILED.value if req.hint_level == HintLevel.SPECIFIC
                else None
            ),
            "sources": pdf_matches,
            "metadata": {
                "response_time_sec": round(elapsed, 2),
                "timestamp": datetime.now().isoformat(),
                "model": "qwen3-max",
                "retrieval_docs": len(relevant_docs),
                "cached": False,
            }
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Hint generation error: {str(e)}")


# ==================== GRADING ====================

@router.post("/api/grading/evaluate", response_model=GradingResponse)
async def ai_partial_grading(req: GradingRequest):
    try:
        # ✅ lazy-init instead of raw global check
        ret = await get_retriever()

        print(f"[Grading] Evaluating student code...")
        start_time = datetime.now()
        total_tests = len(req.test_results['passed']) + len(req.test_results['failed'])
        if total_tests == 0:
            raise HTTPException(status_code=400, detail="No test results provided")

        test_case_score = (len(req.test_results['passed']) / total_tests) * 50
        # DEBUG: print retriever/vectorstore types to detect stale unpatched vectorstore
        try:
            print(f"DEBUG retriever vectorstore class: {type(ret.vectorstore).__name__}")
            print(f"DEBUG vectorstore embed fn: {type(getattr(ret.vectorstore, 'embedding_function', None)).__name__}")
        except Exception as e:
            print(f"DEBUG failed to introspect retriever: {e}")
        relevant_docs = ret.invoke(f"Java {req.problem_description} best practices")
        best_practices = "\n\n".join([
            f"Reference {i+1}:\n{doc.page_content[:400]}"
            for i, doc in enumerate(relevant_docs[:2])
        ])

        grading_prompt = f"""You are a Java instructor grading a practical test.

PROBLEM: {req.problem_description}
EXPECTED APPROACH: {req.expected_approach}

STUDENT'S CODE:
{req.student_code}

TEST RESULTS:
- Passed: {len(req.test_results['passed'])}/{total_tests}
- Failed: {', '.join(req.test_results['failed']) if req.test_results['failed'] else 'None'}

FAILED DETAILS:
Expected: {req.expected_outputs}
Actual: {req.actual_outputs}

BEST PRACTICES:
{best_practices}

GRADING RUBRIC:
1. Approach (0-30): Is the algorithm/logic correct?
2. Code Quality (0-20): Readability, efficiency, conventions

Respond in JSON:
{{
  "approach_score": 25,
  "quality_score": 18,
  "feedback": "Brief assessment",
  "suggestions": ["Fix 1", "Fix 2", "Fix 3"],
  "partial_credit_reasoning": "Why they earned points despite failures",
  "code_quality_notes": "Style and readability notes"
}}"""

        ai_evaluation = await call_llm_json(
            messages=[
                {"role": "system", "content": "You are a fair Java instructor. Respond with valid JSON only."},
                {"role": "user", "content": grading_prompt}
            ],
            temperature=0.3, max_tokens=600, timeout=45
        )

        final_score = (
            test_case_score +
            ai_evaluation['approach_score'] +
            ai_evaluation['quality_score']
        )
        grade_letter = (
            "A" if final_score >= 90 else
            "B" if final_score >= 80 else
            "C" if final_score >= 70 else
            "D" if final_score >= 60 else "F"
        )
        elapsed = (datetime.now() - start_time).total_seconds()

        return GradingResponse(
            total_score=round(final_score, 1),
            breakdown={
                "test_cases": round(test_case_score, 1),
                "approach": ai_evaluation['approach_score'],
                "code_quality": ai_evaluation['quality_score']
            },
            grade_letter=grade_letter,
            feedback=ai_evaluation['feedback'],
            suggestions=ai_evaluation['suggestions'][:3],
            partial_credit_reasoning=ai_evaluation['partial_credit_reasoning'],
            code_quality_notes=ai_evaluation['code_quality_notes'],
            metadata={
                "grading_time_sec": round(elapsed, 2),
                "timestamp": datetime.now().isoformat(),
                "model": "qwen3-max",
                "test_pass_rate": f"{len(req.test_results['passed'])}/{total_tests}",
                "retrieval_docs": len(relevant_docs)
            }
        )
    except json.JSONDecodeError as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to parse grading JSON: {str(e)}")
    except requests.exceptions.HTTPError as e:
        traceback.print_exc()
        status_code = None
        try:
            status_code = e.response.status_code if e.response is not None else None
        except Exception:
            status_code = None
        if status_code == 401:
            raise HTTPException(status_code=503, detail="Embedding service unauthorized — API key may have expired")
        raise HTTPException(status_code=502, detail=f"Embedding service error: {str(e)}")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Grading error: {str(e)}")


# ==================== UTILITY ====================

@router.post("/api/get-full-document")
async def get_full_document(req: DocumentRequest):
    try:
        # ✅ lazy-init
        ret = await get_retriever()

        vectorstore = ret.vectorstore
        # Collect documents (keep full doc objects so we can sort by metadata)
        chunk_list = []
        for doc_id in vectorstore.index_to_docstore_id.values():
            doc = vectorstore.docstore.search(doc_id)
            if doc and doc.metadata.get('source', '').endswith(req.source_file):
                chunk_list.append(doc)

        # Debug: print a sample metadata so we can inspect what fields are available
        if chunk_list:
            try:
                print(f"DEBUG doc metadata sample: {chunk_list[0].metadata}")
            except Exception:
                pass

        # Sort by common order fields if present (page, chunk_index, start_index)
        def _sort_key(d):
            m = d.metadata or {}
            return (
                m.get('page', 0) or 0,
                m.get('chunk_index', 0) or 0,
                m.get('start_index', 0) or 0,
            )

        chunk_list.sort(key=_sort_key)

        matching_docs = [{'content': d.page_content, 'metadata': d.metadata} for d in chunk_list]

        if not matching_docs:
            raise HTTPException(status_code=404, detail=f"No documents found: {req.source_file}")

        return {
            "source_file": req.source_file,
            "full_content": "\n\n".join([d['content'] for d in matching_docs]),
            "num_chunks": len(matching_docs),
            "chunks": matching_docs
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/api/get-chunk-context")
async def get_chunk_context(request: Request):
    try:
        data = await request.json()
        source_file = data.get("source_file")
        chunk_content = data.get("chunk_content")
        if not source_file or not chunk_content:
            raise HTTPException(status_code=400, detail="Missing required fields")

        # ✅ lazy-init
        ret = await get_retriever()

        vectorstore = ret.vectorstore
        # Build a list of Document objects for this source, then sort by metadata
        chunk_list = []
        for doc_id in vectorstore.index_to_docstore_id.values():
            doc = vectorstore.docstore.search(doc_id)
            if doc and doc.metadata.get('source', '').endswith(source_file):
                chunk_list.append(doc)

        if not chunk_list:
            raise HTTPException(status_code=404, detail=f"No chunks: {source_file}")

        # Debug sample metadata
        try:
            print(f"DEBUG doc metadata sample: {chunk_list[0].metadata}")
        except Exception:
            pass

        def _sort_key(d):
            m = d.metadata or {}
            return (
                m.get('page', 0) or 0,
                m.get('chunk_index', 0) or 0,
                m.get('start_index', 0) or 0,
            )

        chunk_list.sort(key=_sort_key)
        all_chunks = [d.page_content for d in chunk_list]

        if not all_chunks:
            raise HTTPException(status_code=404, detail=f"No chunks: {source_file}")

        def _normalize(s: str) -> str:
            return " ".join(s.split()).strip()

        needle = _normalize(chunk_content)
        # Use a short fingerprint to avoid huge comparisons
        needle_preview = needle[:400]

        target_idx = -1
        for i, c in enumerate(all_chunks):
            norm_c = _normalize(c)
            if norm_c == needle:
                target_idx = i
                break
            if needle_preview and (needle_preview in norm_c or norm_c[:len(needle_preview)] in needle):
                target_idx = i
                break

        # Fallback: fuzzy match using sequence similarity
        if target_idx == -1:
            scores = [(i, difflib.SequenceMatcher(None, needle_preview, _normalize(c)[:400]).ratio()) for i, c in enumerate(all_chunks)]
            best_i, best_score = max(scores, key=lambda x: x[1]) if scores else (-1, 0)
            if best_score > 0.6:
                target_idx = best_i

        if target_idx == -1:
            return {"chunks": [clean_chunk_for_display(chunk_content)], "target_index": 0, "total_chunks": len(all_chunks)}

        start_idx = max(0, target_idx - 1)
        end_idx = min(len(all_chunks), target_idx + 2)
        return {
            "chunks": [clean_chunk_for_display(c) for c in all_chunks[start_idx:end_idx]],
            "target_index": target_idx - start_idx,
            "total_chunks": len(all_chunks)
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/rag/health")
async def rag_health():
    global rag_chain, retriever
    return {
        "status": "healthy" if rag_chain is not None else "not_initialized",
        "model": "qwen3-max",
        "embedding": "text-embedding-3-small",
        "performance": {
            "nli_faithfulness": "97.62%",
            "semantic_similarity": "80.78%",
            "context_recall": "74.21%",
            "avg_response_time": "6.73s"
        }
    }


# ==================== CONVERSATION HISTORY MANAGEMENT ====================

class ConversationHistoryRequest(BaseModel):
    user_id: int
    conversation_id: str
    limit: int = 20


class ConversationStatsRequest(BaseModel):
    user_id: int
    conversation_id: Optional[str] = None


class ClearConversationsRequest(BaseModel):
    user_id: int
    days: int = 30


@router.post("/api/conversations/history")
async def get_conversation_history(req: ConversationHistoryRequest):
    try:
        manager = ConversationManager()
        history = manager.get_conversation_history(
            user_id=req.user_id,
            conversation_id=req.conversation_id,
            limit=req.limit,
        )
        return {
            "conversation_id": req.conversation_id,
            "turns": len([m for m in history if m["role"] != "system"]),
            "summaries": len([m for m in history if m["role"] == "system"]),
            "history": history,
            "total_messages": len(history),
        }
    except Exception as e:
        print(f"❌ Error retrieving history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve history: {str(e)}")


@router.post("/api/conversations/stats")
async def get_conversation_stats(req: ConversationStatsRequest):
    try:
        manager = ConversationManager()
        stats = manager.get_conversation_stats(
            user_id=req.user_id,
            conversation_id=req.conversation_id,
        )
        return {
            "stats": stats,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        print(f"❌ Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.post("/api/conversations/create")
async def create_conversation(req: BaseModel):
    try:
        class CreateConvRequest(BaseModel):
            user_id: int

        req_data = await req.__root__
        user_id = req_data.get("user_id")

        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")

        manager = ConversationManager()
        conversation_id = manager.create_conversation_id(user_id)

        return {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "created_at": datetime.now().isoformat(),
            "status": "ready",
        }
    except Exception as e:
        print(f"❌ Error creating conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create conversation: {str(e)}")


@router.post("/api/conversations/clear")
async def clear_old_conversations(req: ClearConversationsRequest):
    try:
        manager = ConversationManager()
        deleted_turns = manager.clear_old_conversations(
            user_id=req.user_id,
            days=req.days,
        )
        return {
            "user_id": req.user_id,
            "days_threshold": req.days,
            "deleted_turns": deleted_turns,
            "cleared_at": datetime.now().isoformat(),
        }
    except Exception as e:
        print(f"❌ Error clearing conversations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear conversations: {str(e)}")


@router.get("/api/conversations/{user_id}/list")
async def list_conversations(user_id: int):
    try:
        manager = ConversationManager()
        db = SessionLocal()

        from db_models import ConversationHistory

        conversations = db.query(
            ConversationHistory.conversation_id,
            func.count(ConversationHistory.id).label("turns"),
            func.max(ConversationHistory.created_at).label("last_updated"),
            func.sum(
                ConversationHistory.input_tokens + ConversationHistory.output_tokens
            ).label("total_tokens"),
        ).filter(
            ConversationHistory.user_id == user_id
        ).group_by(
            ConversationHistory.conversation_id
        ).order_by(
            func.max(ConversationHistory.created_at).desc()
        ).all()

        db.close()

        return {
            "user_id": user_id,
            "total_conversations": len(conversations),
            "conversations": [
                {
                    "conversation_id": conv[0],
                    "turns": conv[1],
                    "last_updated": conv[2].isoformat() if conv[2] else None,
                    "total_tokens": conv[3] or 0,
                }
                for conv in conversations
            ],
        }
    except Exception as e:
        print(f"❌ Error listing conversations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list conversations: {str(e)}")


# ==================== MULTI-SOURCE RAG ====================

class MultiAskRequest(BaseModel):
    question: str
    classroom_ids: List[int]
    include_general: bool = True
    conversation_id: Optional[str] = None
    user_id: Optional[int] = None

@router.post("/ask-multi")
async def ask_multi_classroom(
    body: MultiAskRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Query multiple classroom RAGs and optionally the general KB,
    merge all context, then answer once.
    """
    from services.classroom_rag import search_classroom_context
    from models import HKBULLM
    from core.config import API_KEY, BASE_URL, FAISS_MODEL_NAME, FAISS_API_VERSION

    # Get the backend base URL from the request
    api_base_url = f"{request.url.scheme}://{request.url.netloc}"

    all_chunks = []
    chunks_with_metadata = []  # Keep metadata for pdf_matches

    for cid in body.classroom_ids:
        chunks = search_classroom_context(
            classroom_id=cid,
            query=body.question,
            db=db,
            top_k=4,
        )
        all_chunks.extend(chunks)
        chunks_with_metadata.extend([(cid, chunk) for chunk in chunks])

    if not all_chunks:
        context_str = ""
        system_note = "No classroom documents available."
        pdf_matches = []
    else:
        # Deduplicate chunks using helper
        deduped_text, deduped_with_meta = deduplicate_chunks(chunks_with_metadata)
        
        # Build PDF matches using helper
        pdf_matches = build_pdf_matches_from_classroom_chunks(
            deduped_with_meta,
            api_base_url,
            max_matches=3
        )
        
        print(f"🔍 [DEBUG] Generated {len(pdf_matches)} pdf_matches")
        if pdf_matches:
            print(f"🔍 [DEBUG] First iframeUrl: {pdf_matches[0].get('iframeUrl')}")
        
        all_chunks = deduped_text[:12]
        context_str = "\n\n---\n\n".join(all_chunks)
        system_note = f"Use the provided excerpts from {len(body.classroom_ids)} classroom(s)."

    general_note = ""
    if body.include_general:
        general_note = "You may also draw on your general Java knowledge to supplement the answer."

    prompt = (
        f"You are a Java programming tutor. {system_note} {general_note}\n\n"
        + (f"CLASSROOM CONTEXT:\n{context_str}\n\n" if context_str else "")
        + f"STUDENT QUESTION: {body.question}\n\n"
        "Provide a clear, educational answer."
    )

    llm = HKBULLM(
        api_key=API_KEY,
        base_url=BASE_URL,
        model=FAISS_MODEL_NAME,
        api_version=FAISS_API_VERSION,
        max_tokens=1024,
    )
    answer = llm(prompt)
    
    # Save conversation if user_id is provided
    if current_user and current_user.id:
        conversation_manager = ConversationManager()
        user_id = current_user.id
        if not body.conversation_id:
            body.conversation_id = conversation_manager.create_conversation_id(user_id)
            print(f"📌 Created new multi-classroom conversation: {body.conversation_id}")
        
        save_rag_conversation(
            conversation_manager=conversation_manager,
            user_id=user_id,
            conversation_id=body.conversation_id,
            user_message=body.question,
            assistant_response=answer,
            context_type="multi_classroom_rag",
            pdf_matches=pdf_matches,
            code_snippet=None
        )

    return {
        "answer": answer,
        "conversation_id": body.conversation_id,
        "sources_count": len(all_chunks),
        "classrooms_searched": body.classroom_ids,
        "general_included": body.include_general,
        "debug_log": {
            "pdf_matches": pdf_matches,
        }
    }

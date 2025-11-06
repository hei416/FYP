import json
import traceback
from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.cache_service import load_cache_stage_db, save_cache_stage_db
from services.model_service import call_model
from services.pdf_service import search_pdf_chunks
from services.rag_pipeline import search_json_content
from core.config import ROUTING_PROMPT, COMPRESSION_PROMPT, ANSWER_PROMPT, VERIFICATION_PROMPT, ARBITRATION_PROMPT, PDF_CHUNKS
from core.utils import format_answers, format_verifications

router = APIRouter()

class ExplainRequest(BaseModel):
    user_input: str
    history: List[Dict[str, Any]] = []

@router.post("/ragAI")
async def rag_ai(req: ExplainRequest, db: Session = Depends(get_db)):
    try:
        query = req.user_input.strip()
        if not query:
            raise HTTPException(status_code=400, detail="Query cannot be empty")
        
        debug_log = {"query": query, "timestamp": datetime.now().isoformat()}
        cache_key = query  # Using query as key for caching

        # Bypass RAG pipeline for direct model call
        print(f"[DIRECT CALL] Calling model with query: {query[:30]}...")
        direct_response = call_model("gpt-5-mini", [
            {"role": "user", "content": query}
        ])
        final = direct_response
        debug_log["final_answer"] = final

        result = {"final_answer": final, "debug_log": debug_log}
        save_cache_stage_db(cache_key, "final_result", json.dumps(result), db)
        
        return result

        # Original RAG pipeline steps (commented out)
        # # Check for cached final result first
        # if final_result := load_cache_stage_db(cache_key, "final_result", db):
        #     print(f"[CACHE] Loaded final result for: {query[:20]}...")
        #     return json.loads(final_result)

        # # Load intermediate stages
        # routing_result = load_cache_stage_db(cache_key, "routing", db)
        # pdf_context = load_cache_stage_db(cache_key, "pdf_context", db)
        # pdf_matches = load_cache_stage_db(cache_key, "pdf_matches", db)
        # json_context = load_cache_stage_db(cache_key, "json_context", db)
        # narrowed = load_cache_stage_db(cache_key, "narrowed", db)
        
        # # Convert stored matches if available
        # pdf_matches_list = []
        # if pdf_matches:
        #     try:
        #         pdf_matches_list = json.loads(pdf_matches)
        #     except:
        #         pdf_matches_list = []

        # # If all stages are cached
        # if routing_result and pdf_context and pdf_matches and json_context and narrowed:
        #     print(f"[CACHE] Loaded all stages for: {query[:20]}...")
        # else:
        #     # Step 1: Routing
        #     if not routing_result:
        #         print(f"[1/6] Routing query: {query[:30]}...")
        #         routing_result = call_model("gpt-4-o-mini", [
        #             {"role": "system", "content": ROUTING_PROMPT},
        #             {"role": "user", "content": query}
        #         ]).lower()
                
        #         # Validate routing result
        #         if "pdf" not in routing_result and "json" not in routing_result:
        #             routing_result = "both"  # Default fallback
                    
        #         save_cache_stage_db(cache_key, "routing", routing_result, db)
        #     debug_log["routing"] = routing_result

        #     # Step 2: Context Retrieval
        #     if "pdf" in routing_result and (not pdf_context or not pdf_matches):
        #         print(f"[2/6] Retrieving PDF context: {query[:30]}...")
        #         pdf_context, pdf_matches_list = search_pdf_chunks(PDF_CHUNKS, query)
        #         save_cache_stage_db(cache_key, "pdf_context", pdf_context, db)
        #         save_cache_stage_db(cache_key, "pdf_matches", json.dumps(pdf_matches_list), db)
            
        #     if "json" in routing_result and not json_context:
        #         print(f"[2/6] Retrieving JSON context: {query[:30]}...")
        #         json_context = search_json_content(query)
        #         save_cache_stage_db(cache_key, "json_context", json_context, db)
            
        #     # Combine contexts based on routing
        #     context = ""
        #     if "pdf" in routing_result and "json" in routing_result:
        #         context = f"PDF CONTEXT:\n{pdf_context}\n\nJSON CONTEXT:\n{json_context}"
        #     elif "pdf" in routing_result:
        #         context = pdf_context
        #     elif "json" in routing_result:
        #         context = json_context
        #     else:
        #         context = "No relevant context found"
            
        #     # Step 3: Context Compression
        #     if not narrowed:
        #         print(f"[3/6] Compressing context: {query[:30]}...")
        #         narrowed = call_model("gpt-4-o-mini", [
        #             {"role": "system", "content": COMPRESSION_PROMPT},
        #             {"role": "user", "content": f"Query: {query}\nContext:\n{context[:6000]}"}
        #         ])
        #         save_cache_stage_db(cache_key, "narrowed", narrowed, db)
        #     debug_log["compressed_context"] = narrowed[:500] + "..." if len(narrowed) > 500 else narrowed

        # # Populate debug log
        # debug_log["pdf_matches"] = pdf_matches_list[:3] if pdf_matches_list else []
        # debug_log["json_context"] = json_context[:300] + "..." if json_context else ""

        # # Step 4: Answer Generation
        # print(f"[4/6] Generating answers: {query[:30]}...")
        # gen_models = ["gpt-4-o", "gemini-1.5-pro"]
        # answers = []
        # for model in gen_models:
        #     response = call_model(model, [
        #         {"role": "system", "content": ANSWER_PROMPT},
        #         {"role": "user", "content": f"Query: {query}\nRelevant Context:\n{narrowed[:4000]}"}
        #     ])
        #     answers.append({"model": model, "answer": response})
        # debug_log["generated_answers"] = [{"model": a["model"], "summary": a["answer"][:100]} for a in answers]

        # # Step 5: Answer Verification
        # print(f"[5/6] Verifying answers: {query[:30]}...")
        # ver_models = ["gpt-4-o", "deepseek-r1"]
        # formatted_answers = format_answers(answers)
        # verifications = []
        # for model in ver_models:
        #     verdict = call_model(model, [
        #         {"role": "system", "content": VERIFICATION_PROMPT},
        #         {"role": "user", "content": f"Query: {query}\nContext:\n{narrowed[:3000]}\n\nAnswers:\n{formatted_answers[:2000]}"}
        #     ])
        #     verifications.append({"model": model, "verification": verdict})
        # debug_log["verifications"] = [{"model": v["model"], "summary": v["verification"][:100]} for v in verifications]

        # # Step 6: Final Arbitration
        # print(f"[6/6] Final arbitration: {query[:30]}...")
        # arb_input = f"## Answers\n{formatted_answers[:3000]}\n\n## Verifications\n{format_verifications(verifications)[:2000]}"
        # final = call_model("gpt-4-o-mini", [
        #     {"role": "system", "content": ARBITRATION_PROMPT},
        #     {"role": "user", "content": arb_input}
        # ])
        # debug_log["final_answer"] = final

        # # Prepare and cache result
        # result = {"final_answer": final, "debug_log": debug_log}
        # save_cache_stage_db(cache_key, "final_result", json.dumps(result), db)
        
        # return result

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"RAG processing failed: {str(e)}"
        )

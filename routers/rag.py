from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from enum import Enum
import httpx
import json
import time
import asyncio
import random
import requests
import torch
import torch.nn.functional as F
import difflib
import re
import logging
import uuid
from sqlalchemy import func
from database import SessionLocal
from db_models import QuizQuestion as QuizQuestionModel, PracticalTestHint as PracticalTestHintModel, SavedWork, Classroom, ClassroomMember, NLIMonitoringLog
from fastapi import Depends
from sqlalchemy.orm import Session

from core.rate_limiter import limiter
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
from services.nli_monitor import get_nli_monitor
from concurrent.futures import ThreadPoolExecutor
_embed_executor = ThreadPoolExecutor(max_workers=6)



logger = logging.getLogger(__name__)

router = APIRouter()

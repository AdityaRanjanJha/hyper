# integrity/schemas.py

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class SubmitAnswerRequest(BaseModel):
    user_id: str
    session_id: str
    answer: str
    previous_answers: List[str] = []

class SubmitProctoringRequest(BaseModel):
    user_id: str
    session_id: str
    frame: Optional[str] = None  # base64 image or similar
    audio_chunk: Optional[str] = None  # base64 audio or similar

class FollowUpOutcomeRequest(BaseModel):
    event_id: int
    outcome: str
    reviewer_id: str

class IntegrityEventResponse(BaseModel):
    id: int
    user_id: str
    session_id: str
    event_type: str
    evidence: str
    confidence: float
    timestamp: datetime

class TimelineResponse(BaseModel):
    timeline: List[IntegrityEventResponse]

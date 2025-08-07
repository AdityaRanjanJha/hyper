# integrity/router.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from .schemas import (
    SubmitAnswerRequest, SubmitProctoringRequest, FollowUpOutcomeRequest,
    IntegrityEventResponse, TimelineResponse
)
from .analysis import check_similarity, check_style_drift
from .proctoring import detect_presence, detect_gaze, detect_background_speech
from .db import IntegrityEvent, FollowUpOutcome, get_db
from datetime import datetime

router = APIRouter()

@router.post("/submit-answer/")
async def submit_answer(req: SubmitAnswerRequest, db: AsyncSession = Depends(get_db)):
    flagged_events = []

    # Similarity check
    sim_flag, sim_conf, sim_evidence = check_similarity(req.answer, req.previous_answers)
    if sim_flag:
        event = IntegrityEvent(
            user_id=req.user_id,
            session_id=req.session_id,
            event_type="similarity",
            evidence=sim_evidence,
            confidence=sim_conf,
            timestamp=datetime.utcnow()
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        flagged_events.append(event.id)

    # Style drift check
    drift_flag, drift_conf, drift_evidence = check_style_drift(req.answer, req.previous_answers)
    if drift_flag:
        event = IntegrityEvent(
            user_id=req.user_id,
            session_id=req.session_id,
            event_type="style_drift",
            evidence=drift_evidence,
            confidence=drift_conf,
            timestamp=datetime.utcnow()
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        flagged_events.append(event.id)

    return {"flagged_events": flagged_events}

@router.post("/submit-proctoring/")
async def submit_proctoring(req: SubmitProctoringRequest, db: AsyncSession = Depends(get_db)):
    flagged_events = []

    # Presence
    pres_flag, pres_conf, pres_evidence = detect_presence(req.frame)
    if not pres_flag:
        event = IntegrityEvent(
            user_id=req.user_id,
            session_id=req.session_id,
            event_type="presence",
            evidence=pres_evidence,
            confidence=pres_conf,
            timestamp=datetime.utcnow()
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        flagged_events.append(event.id)

    # Gaze
    gaze_flag, gaze_conf, gaze_evidence = detect_gaze(req.frame)
    if gaze_flag:
        event = IntegrityEvent(
            user_id=req.user_id,
            session_id=req.session_id,
            event_type="gaze",
            evidence=gaze_evidence,
            confidence=gaze_conf,
            timestamp=datetime.utcnow()
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        flagged_events.append(event.id)

    # Speech
    speech_flag, speech_conf, speech_evidence = detect_background_speech(req.audio_chunk)
    if speech_flag:
        event = IntegrityEvent(
            user_id=req.user_id,
            session_id=req.session_id,
            event_type="speech",
            evidence=speech_evidence,
            confidence=speech_conf,
            timestamp=datetime.utcnow()
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        flagged_events.append(event.id)

    return {"flagged_events": flagged_events}

@router.get("/timeline/{session_id}", response_model=TimelineResponse)
async def get_timeline(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IntegrityEvent).where(IntegrityEvent.session_id == session_id).order_by(IntegrityEvent.timestamp)
    )
    events = result.scalars().all()
    timeline = [
        IntegrityEventResponse(
            id=e.id,
            user_id=e.user_id,
            session_id=e.session_id,
            event_type=e.event_type,
            evidence=e.evidence,
            confidence=e.confidence,
            timestamp=e.timestamp
        )
        for e in events
    ]
    return {"timeline": timeline}

@router.post("/follow-up/")
async def follow_up(req: FollowUpOutcomeRequest, db: AsyncSession = Depends(get_db)):
    outcome = FollowUpOutcome(
        event_id=req.event_id,
        outcome=req.outcome,
        reviewer_id=req.reviewer_id,
        timestamp=datetime.utcnow()
    )
    db.add(outcome)
    await db.commit()
    return {"status": "recorded"}

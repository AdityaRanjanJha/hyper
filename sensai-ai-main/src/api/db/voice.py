"""
Voice Database Operations

Database helper functions for voice onboarding system
"""

import sqlite3
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path
import os

def get_db_path():
    """Get the database path from environment or default"""
    if os.path.exists("/appdata"):
        return "/appdata/sensai.db"
    else:
        # Development path
        return Path(__file__).parent.parent.parent / "db" / "db.sqlite"

async def create_voice_session(user_id: Optional[int] = None, context: Dict[str, Any] = None) -> str:
    """Create a new voice session and return session UUID"""
    session_uuid = str(uuid.uuid4())
    db_path = get_db_path()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO voice_sessions (session_uuid, user_id, step_data)
            VALUES (?, ?, ?)
        """, (session_uuid, user_id, json.dumps(context or {})))
        
        # Log session start analytics
        cursor.execute("""
            INSERT INTO voice_analytics (session_uuid, event_type, event_data)
            VALUES (?, 'session_start', ?)
        """, (session_uuid, json.dumps({
            'user_id': user_id,
            'context': context or {}
        })))
        
        conn.commit()
        return session_uuid
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

async def update_voice_session_step(session_uuid: str, step: str, step_data: Dict[str, Any] = None) -> bool:
    """Update the current step of a voice session"""
    db_path = get_db_path()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE voice_sessions 
            SET current_step = ?, step_data = ?, updated_at = CURRENT_TIMESTAMP
            WHERE session_uuid = ?
        """, (step, json.dumps(step_data or {}), session_uuid))
        
        # Log step completion analytics
        cursor.execute("""
            INSERT INTO voice_analytics (session_uuid, event_type, event_data)
            VALUES (?, 'step_completed', ?)
        """, (session_uuid, json.dumps({
            'step': step,
            'step_data': step_data or {}
        })))
        
        conn.commit()
        return cursor.rowcount > 0
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

async def complete_voice_session(session_uuid: str) -> bool:
    """Mark a voice session as completed"""
    db_path = get_db_path()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE voice_sessions 
            SET completed = TRUE, current_step = 'complete', updated_at = CURRENT_TIMESTAMP
            WHERE session_uuid = ?
        """, (session_uuid,))
        
        # Log session completion analytics
        cursor.execute("""
            INSERT INTO voice_analytics (session_uuid, event_type, event_data)
            VALUES (?, 'session_completed', ?)
        """, (session_uuid, json.dumps({
            'completed_at': datetime.utcnow().isoformat()
        })))
        
        conn.commit()
        return cursor.rowcount > 0
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

async def log_voice_intent(session_uuid: str, transcript: str, intent: str, confidence: float, context: Dict[str, Any] = None) -> None:
    """Log a voice intent recognition for analytics and training"""
    db_path = get_db_path()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Update session with transcript and intent
        cursor.execute("""
            UPDATE voice_sessions 
            SET transcript = ?, intent = ?, updated_at = CURRENT_TIMESTAMP
            WHERE session_uuid = ?
        """, (transcript, intent, session_uuid))
        
        # Log intent in intents table for training
        cursor.execute("""
            INSERT INTO voice_intents (transcript, intent, confidence, context)
            VALUES (?, ?, ?, ?)
        """, (transcript, intent, confidence, json.dumps(context or {})))
        
        # Log intent recognition analytics
        cursor.execute("""
            INSERT INTO voice_analytics (session_uuid, event_type, event_data)
            VALUES (?, 'intent_recognized', ?)
        """, (session_uuid, json.dumps({
            'transcript': transcript,
            'intent': intent,
            'confidence': confidence,
            'context': context or {}
        })))
        
        conn.commit()
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

async def get_voice_session(session_uuid: str) -> Optional[Dict[str, Any]]:
    """Get voice session details"""
    db_path = get_db_path()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT session_uuid, user_id, intent, transcript, current_step, 
                   completed, step_data, created_at, updated_at
            FROM voice_sessions
            WHERE session_uuid = ?
        """, (session_uuid,))
        
        row = cursor.fetchone()
        if row:
            return {
                'session_uuid': row[0],
                'user_id': row[1],
                'intent': row[2],
                'transcript': row[3],
                'current_step': row[4],
                'completed': bool(row[5]),
                'step_data': json.loads(row[6]) if row[6] else {},
                'created_at': row[7],
                'updated_at': row[8]
            }
        return None
        
    finally:
        conn.close()

async def get_voice_analytics() -> Dict[str, Any]:
    """Get voice onboarding analytics"""
    db_path = get_db_path()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Total sessions
        cursor.execute("SELECT COUNT(*) FROM voice_sessions")
        total_sessions = cursor.fetchone()[0]
        
        # Completed sessions
        cursor.execute("SELECT COUNT(*) FROM voice_sessions WHERE completed = TRUE")
        completed_sessions = cursor.fetchone()[0]
        
        # Common intents
        cursor.execute("""
            SELECT intent, COUNT(*) as count
            FROM voice_intents
            WHERE intent IS NOT NULL
            GROUP BY intent
            ORDER BY count DESC
            LIMIT 10
        """)
        common_intents = dict(cursor.fetchall())
        
        # Success rate
        success_rate = (completed_sessions / total_sessions * 100) if total_sessions > 0 else 0
        
        # Average session duration (mock for now)
        avg_completion_time = "3.5 minutes"
        
        return {
            'total_sessions': total_sessions,
            'completed_sessions': completed_sessions,
            'success_rate': round(success_rate, 2),
            'common_intents': common_intents,
            'avg_completion_time': avg_completion_time
        }
        
    finally:
        conn.close()

async def get_recent_voice_sessions(limit: int = 10, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get recent voice sessions"""
    db_path = get_db_path()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        if user_id:
            cursor.execute("""
                SELECT session_uuid, user_id, intent, transcript, current_step, 
                       completed, created_at
                FROM voice_sessions
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (user_id, limit))
        else:
            cursor.execute("""
                SELECT session_uuid, user_id, intent, transcript, current_step, 
                       completed, created_at
                FROM voice_sessions
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,))
        
        rows = cursor.fetchall()
        return [
            {
                'session_uuid': row[0],
                'user_id': row[1],
                'intent': row[2],
                'transcript': row[3],
                'current_step': row[4],
                'completed': bool(row[5]),
                'created_at': row[6]
            }
            for row in rows
        ]
        
    finally:
        conn.close()

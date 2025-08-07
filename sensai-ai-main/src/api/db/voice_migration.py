"""
Voice Onboarding Database Schema

SQLite schema for voice onboarding sessions and analytics
"""

import sqlite3
from pathlib import Path
import os

# Get database path from config
def get_db_path():
    """Get the database path from environment or default"""
    if os.path.exists("/appdata"):
        return "/appdata/sensai.db"
    else:
        # Development path
        return Path(__file__).parent.parent.parent / "db" / "db.sqlite"

def create_voice_tables():
    """Create voice onboarding related tables"""
    db_path = get_db_path()
    
    # Ensure directory exists
    db_dir = Path(db_path).parent
    db_dir.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Voice sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS voice_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_uuid TEXT UNIQUE NOT NULL,
            user_id INTEGER,
            intent TEXT,
            transcript TEXT,
            current_step TEXT DEFAULT 'welcome',
            completed BOOLEAN DEFAULT FALSE,
            step_data TEXT, -- JSON data for step-specific information
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    
    # Voice analytics table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS voice_analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_uuid TEXT NOT NULL,
            event_type TEXT NOT NULL, -- 'session_start', 'intent_recognized', 'step_completed', 'session_completed'
            event_data TEXT, -- JSON data for event-specific information
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_uuid) REFERENCES voice_sessions (session_uuid)
        )
    """)
    
    # Voice intents table for training data
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS voice_intents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transcript TEXT NOT NULL,
            intent TEXT NOT NULL,
            confidence REAL DEFAULT 0.0,
            context TEXT, -- JSON context data
            user_feedback TEXT, -- 'correct', 'incorrect', NULL
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create indexes for better performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON voice_sessions(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_voice_sessions_created_at ON voice_sessions(created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_voice_analytics_session_uuid ON voice_analytics(session_uuid)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_voice_analytics_event_type ON voice_analytics(event_type)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_voice_intents_intent ON voice_intents(intent)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_voice_intents_created_at ON voice_intents(created_at)")
    
    conn.commit()
    conn.close()
    
    print("Voice onboarding tables created successfully!")

if __name__ == "__main__":
    create_voice_tables()

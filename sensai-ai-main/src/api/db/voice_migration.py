"""
Voice functionality database migration
Creates tables for voice sessions and interactions
"""

from api.utils.db import get_new_db_connection
from api.config import settings


async def create_voice_tables():
    """Create voice-related database tables"""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        
        try:
            # Create voice_sessions table
            await cursor.execute("""
                CREATE TABLE IF NOT EXISTS voice_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_uuid TEXT NOT NULL UNIQUE,
                    user_id TEXT,
                    intent TEXT,
                    transcript TEXT,
                    completed BOOLEAN DEFAULT FALSE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create voice_interactions table
            await cursor.execute("""
                CREATE TABLE IF NOT EXISTS voice_interactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_uuid TEXT NOT NULL,
                    user_message TEXT NOT NULL,
                    ai_response TEXT NOT NULL,
                    intent TEXT,
                    action_taken TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create indexes for better performance
            await cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_voice_sessions_uuid 
                ON voice_sessions (session_uuid)
            """)
            
            await cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_voice_interactions_session 
                ON voice_interactions (session_uuid)
            """)
            
            await cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_voice_interactions_created 
                ON voice_interactions (created_at)
            """)
            
            await conn.commit()
            print("Voice tables created successfully")
            
        except Exception as e:
            print(f"Error creating voice tables: {e}")
            raise e


if __name__ == "__main__":
    import asyncio
    asyncio.run(create_voice_tables())
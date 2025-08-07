#!/usr/bin/env python3
"""
Database initialization script for the sensai API backend.
This script creates all necessary database tables.
"""

import asyncio
import sys
import os

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from api.db import init_db


async def main():
    """Initialize the database with all required tables."""
    try:
        print("Initializing database...")
        await init_db()
        print("✅ Database initialized successfully!")
        print("All required tables have been created.")
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

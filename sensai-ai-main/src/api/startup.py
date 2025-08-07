# src/api/startup.py

from fastapi import FastAPI
from integrity.router import router as integrity_router

app = FastAPI()

app.include_router(integrity_router, prefix="/integrity")

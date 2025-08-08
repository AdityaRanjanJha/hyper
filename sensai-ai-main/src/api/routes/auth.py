from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict
from api.db.user import insert_or_return_user
from api.utils.db import get_new_db_connection
from api.models import UserLoginData
from google.oauth2 import id_token
from google.auth.transport import requests
from api.settings import settings
import os

router = APIRouter()


@router.post("/login")
async def login_or_signup_user(user_data: UserLoginData) -> Dict:
    # Debug logging
    print(f"DEBUG: Login attempt for email: {user_data.email}")
    print(f"DEBUG: Google Client ID configured: {bool(settings.google_client_id)}")
    print(f"DEBUG: ID token provided: {bool(user_data.id_token)}")
    
    # Verify the Google ID token
    try:
        if not settings.google_client_id:
            print("ERROR: Google Client ID not configured")
            raise HTTPException(status_code=500, detail="Google Client ID not configured")

        request_adapter = requests.Request()
        print("DEBUG: Attempting to verify token with Google (no skew)...")
        try:
            id_info = id_token.verify_oauth2_token(
                user_data.id_token,
                request_adapter,
                settings.google_client_id,
            )
        except ValueError as inner_err:
            err_text = str(inner_err)
            # Handle clock skew / 'Token used too early' gracefully with a retry allowing small skew
            if "Token used too early" in err_text or "used too early" in err_text:
                print("WARN: Token used too early – retrying with 10s clock skew allowance. Check system clock sync.")
                try:
                    id_info = id_token.verify_oauth2_token(
                        user_data.id_token,
                        request_adapter,
                        settings.google_client_id,
                        clock_skew_in_seconds=10,
                    )
                except ValueError as skew_err:
                    print(f"ERROR: Retry with clock skew failed: {skew_err}")
                    raise HTTPException(
                        status_code=401,
                        detail=(
                            "Token not yet valid (system clock may be behind). Please sync your system time and retry."
                        ),
                    )
            else:
                print(f"ERROR: Token verification failed: {err_text}")
                raise HTTPException(status_code=401, detail=f"Invalid authentication token: {err_text}")

        print(f"DEBUG: Token verified successfully. Email from token: {id_info.get('email')}")

        if id_info.get("email") != user_data.email:
            print(f"ERROR: Email mismatch. Token: {id_info.get('email')}, Provided: {user_data.email}")
            raise HTTPException(status_code=401, detail="Email in token doesn't match provided email")

    except HTTPException:
        # Already logged and raised above
        raise
    except Exception as e:
        print(f"ERROR: Unexpected token verification error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

    # If token is valid, proceed with user creation/retrieval
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        user = await insert_or_return_user(
            cursor,
            user_data.email,
            user_data.given_name,
            user_data.family_name,
        )
        await conn.commit()

    return user

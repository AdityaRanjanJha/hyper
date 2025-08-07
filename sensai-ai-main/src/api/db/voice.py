"""
Voice Onboarding API Routes

FastAPI routes for voice-guided onboarding functionality
"""

from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any
import uuid
import json
from datetime import datetime

from api.utils.db import get_new_db_connection
from api.models import User
from api.llm import get_openai_client

# Initialize router
router = APIRouter(tags=["voice"])

# Voice session storage (in-memory for now, should be Redis in production)
voice_sessions: Dict[str, Dict[str, Any]] = {}

@router.post("/sessions")
async def create_voice_session(request: Dict[str, Any]):
    """Create a new voice onboarding session"""
    try:
        session_id = str(uuid.uuid4())
        
        session_data = {
            "id": session_id,
            "user_id": request.get("user_id"),
            "created_at": datetime.utcnow().isoformat(),
            "current_step": "welcome",
            "context": request.get("context", {}),
            "completed_steps": [],
            "transcript_history": []
        }
        
        voice_sessions[session_id] = session_data
        
        return {
            "session_id": session_id,
            "message": "Voice session created successfully",
            "initial_step": "welcome",
            "welcome_message": "Welcome to SensAI! I'm your voice guide. I can help you sign up, join courses, and make your first submission. What would you like to do?"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create voice session: {str(e)}")

@router.post("/intent")
async def process_voice_intent(request: Dict[str, Any]):
    """Process voice transcript and determine user intent"""
    try:
        transcript = request["transcript"].lower().strip()
        context = request["context"]
        current_step = context.get("currentStep", "welcome")
        
        # Try to use OpenAI, fallback to local processing if not available
        try:
            client = get_openai_client()
            
            # Create system prompt for intent recognition
            system_prompt = f"""
            You are a voice assistant for SensAI, an educational platform. 
            
            Current context:
            - User's current step: {current_step}
            - Current URL: {context.get('currentUrl', '/')}
            - User authenticated: {context.get('userIsAuthenticated', False)}
            - User has courses: {context.get('userHasCourses', False)}
            
            User said: "{transcript}"
            
            Analyze the intent and respond with ONLY a JSON object in this exact format:
            {{
                "intent": "signup|join_course|submit_assignment|help|repeat|stop|unknown",
                "confidence": 0.0-1.0,
                "action": {{
                    "type": "navigate|highlight|speak|form_fill|click",
                    "target": "URL or CSS selector or null",
                    "message": "response to speak to user",
                    "data": {{}}
                }},
                "next_step": "welcome|signup|join-course|first-submission|complete|idle"
            }}
            
            Guidelines:
            - For signup intent: navigate to /auth/signup and provide guidance
            - For course joining: navigate to /courses and help them browse
            - For assignment submission: guide them to submit their work
            - For help/repeat: provide helpful instructions for current step
            - For stop: end the onboarding
            - Use "speak" action to provide verbal feedback
            - Use "highlight" action to draw attention to specific elements
            - Use "navigate" action to move to different pages
            """
            
            # Get response from OpenAI
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": transcript}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            # Parse the response
            response_text = response.choices[0].message.content.strip()
            
            # Try to parse as JSON
            try:
                intent_data = json.loads(response_text)
            except json.JSONDecodeError:
                # Fallback to basic intent recognition
                intent_data = _fallback_intent_recognition(transcript, context)
                
        except Exception as openai_error:
            print(f"OpenAI not available, using fallback: {openai_error}")
            # Use fallback intent recognition
            intent_data = _fallback_intent_recognition(transcript, context)
        
        # Validate and enhance the response
        enhanced_response = _enhance_intent_response(intent_data, context)
        
        return enhanced_response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process voice intent: {str(e)}")
        
        # Parse the response
        response_text = response.choices[0].message.content.strip()
        
        # Try to parse as JSON
        try:
            intent_data = json.loads(response_text)
        except json.JSONDecodeError:
            # Fallback to basic intent recognition
            intent_data = _fallback_intent_recognition(transcript, context)
            
        except Exception as openai_error:
            print(f"OpenAI not available, using fallback: {openai_error}")
            # Use fallback intent recognition
            intent_data = _fallback_intent_recognition(transcript, context)
        
        # Validate and enhance the response
        enhanced_response = _enhance_intent_response(intent_data, context)
        
        return enhanced_response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process voice intent: {str(e)}")

@router.get("/analytics")
async def get_voice_analytics():
    """Get voice onboarding analytics"""
    try:
        # Count sessions
        total_sessions = len(voice_sessions)
        completed_sessions = len([s for s in voice_sessions.values() if s.get("current_step") == "complete"])
        
        # Get common intents (would be from database in production)
        common_intents = {
            "signup": 45,
            "join_course": 38,
            "help": 25,
            "submit_assignment": 15,
            "unknown": 12
        }
        
        # Calculate success rate
        success_rate = (completed_sessions / total_sessions * 100) if total_sessions > 0 else 0
        
        return {
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "success_rate": round(success_rate, 2),
            "common_intents": common_intents,
            "avg_completion_time": "3.5 minutes"  # Mock data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")

def _fallback_intent_recognition(transcript: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """Fallback intent recognition when OpenAI fails"""
    transcript_lower = transcript.lower()
    
    # Simple keyword matching
    if any(word in transcript_lower for word in ["sign up", "signup", "register", "create account"]):
        return {
            "intent": "signup",
            "confidence": 0.8,
            "action": {
                "type": "navigate",
                "target": "/auth/signup",
                "message": "I'll help you create an account. Let me take you to the signup page."
            },
            "next_step": "signup"
        }
    
    elif any(word in transcript_lower for word in ["course", "join", "enroll", "class"]):
        return {
            "intent": "join_course",
            "confidence": 0.8,
            "action": {
                "type": "navigate",
                "target": "/courses",
                "message": "Let me show you our available courses."
            },
            "next_step": "join-course"
        }
    
    elif any(word in transcript_lower for word in ["submit", "assignment", "homework", "task"]):
        return {
            "intent": "submit_assignment",
            "confidence": 0.8,
            "action": {
                "type": "speak",
                "message": "I'll help you submit your assignment. First, make sure you're enrolled in a course."
            },
            "next_step": "first-submission"
        }
    
    elif any(word in transcript_lower for word in ["help", "what can", "how do"]):
        return {
            "intent": "help",
            "confidence": 0.9,
            "action": {
                "type": "speak",
                "message": "I can help you sign up for an account, join a course, or submit your first assignment. What would you like to do?"
            },
            "next_step": None
        }

    elif any(phrase in transcript_lower for phrase in [
        "what does this page say", "read this page", "read the page",
        "what does this screen say", "read this screen", "read the screen",
        "describe this page", "describe this screen", "what's on this page",
        "what's on this screen", "read the instructions", "read instructions",
        "what does it say", "tell me what it says", "read this",
        "read the content", "what's the content", "scan this page",
        "analyze this page", "extract the text", "what text is here",
        "explain this page", "can you explain this page", "explain this screen",
        "tell me about this page", "what is this page", "what is on this page",
        "describe what you see", "what can you see", "summary of this page",
        "page summary", "content summary", "overview of this page",
        "walk me through this page", "guide me through this page",
        "can you explain this page to me", "explain this page to me"
    ]):
        return {
            "intent": "read_page",
            "confidence": 0.9,
            "action": {
                "type": "speak",
                "message": "I'll analyze the current page content for you. Let me extract and summarize what's visible on this screen."
            },
            "next_step": None
        }
    
    elif any(phrase in transcript_lower for phrase in [
        "what should i click", "where should i click", "what button should i click",
        "how do i", "where is the", "find the", "show me the", "where can i",
        "what should i click to", "where should i click to", "how can i",
        "where do i click to", "what do i click to", "which button",
        "which button should i click", "where is the button", "find button",
        "show me button", "highlight button", "where to click",
        "how to add", "how to create", "how to submit", "how to join",
        "where to add", "where to create", "where to submit", "where to join"
    ]):
        return {
            "intent": "find_element",
            "confidence": 0.9,
            "action": {
                "type": "speak",
                "message": "Let me help you find the right button or element on this page. I'll analyze the available options and highlight what you're looking for."
            },
            "next_step": None
        }
    
    elif any(word in transcript_lower for word in ["stop", "quit", "exit", "done"]):
        return {
            "intent": "stop",
            "confidence": 0.9,
            "action": {
                "type": "speak",
                "message": "Thanks for using voice guidance! You can always restart it from the Voice Guide button."
            },
            "next_step": "idle"
        }
    
    else:
        return {
            "intent": "unknown",
            "confidence": 0.3,
            "action": {
                "type": "speak",
                "message": "I'm not sure what you meant. Try saying 'help' to see what I can do, or say 'sign up', 'join course', or 'submit assignment'."
            },
            "next_step": None
        }

def _enhance_intent_response(intent_data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """Enhance and validate the intent response"""
    
    # Set defaults
    intent_data.setdefault("confidence", 0.5)
    intent_data.setdefault("action", {})
    intent_data["action"].setdefault("type", "speak")
    
    # Add helpful context to messages
    if intent_data["intent"] == "join_course" and not context.get("userHasCourses", False):
        intent_data["action"]["message"] += " Since this will be your first course, I'll guide you through the process step by step."
    
    return intent_data

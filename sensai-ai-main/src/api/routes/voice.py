"""
Voice interaction API endpoints for SensAI
Handles voice sessions, intent processing, and OpenAI integration with comprehensive onboarding flows
"""

import uuid
import json
import asyncio
import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import openai
from api.utils.db import get_new_db_connection

router = APIRouter()

# OpenAI client initialization
openai.api_key = os.getenv("OPENAI_API_KEY")

# Enhanced Pydantic models for comprehensive voice system
class VoiceSessionCreate(BaseModel):
    session_uuid: str
    user_id: str = None
    intent: str = "welcome"
    transcript: str = ""
    completed: bool = False

class VoiceIntentRequest(BaseModel):
    userId: str = None
    utterance: str
    memory: Dict[str, Any] = Field(default_factory=dict)
    currentRoute: Optional[str] = None  # Add current page route
    pageContext: Optional[Dict[str, Any]] = None  # Add page context info

class VoiceCommandRequest(BaseModel):
    userId: str = None
    command: str  # stop, repeat, retry
    memory: Dict[str, Any] = Field(default_factory=dict)

class VoiceAction(BaseModel):
    type: str  # 'navigate', 'highlight', 'speak', 'form_fill', 'click', 'confirm'
    target: Optional[str] = None
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class VoiceIntentResponse(BaseModel):
    intent: str
    slots: Dict[str, Any] = Field(default_factory=dict)
    responseText: str
    memory: Dict[str, Any] = Field(default_factory=dict)
    action: Optional[VoiceAction] = None
    requiresConfirmation: bool = False

class AnalyticsEvent(BaseModel):
    userId: str
    timestamp: datetime = Field(default_factory=datetime.now)
    eventType: str
    intent: str = None
    slots: Dict[str, Any] = Field(default_factory=dict)
    memorySnapshot: Dict[str, Any] = Field(default_factory=dict)
    responseText: str = None

# Route mapping for voice navigation with context
ROUTE_MAPPING = {
    "home": {
        "route": "/",
        "context": "Home page with course overview",
        "selectors": {
            "create_course_btn": "button:contains('Create course')",
            "course_cards": "[class*='course']",
            "voice_button": "button[title*='Voice']",
            "teaching_tab": "button:contains('Created by you')",
            "learning_tab": "button:contains('Enrolled courses')"
        },
        "capabilities": ["create_course", "browse_courses", "switch_tabs", "voice_guide"],
        "next_actions": {
            "no_courses": "create first course or browse available courses",
            "has_courses": "view course details, create new course, or manage existing ones",
            "teaching_mode": "create new course or manage existing courses",
            "learning_mode": "browse and join new courses"
        }
    },
    "signup": {
        "route": "/signup",
        "context": "Account creation and registration",
        "selectors": {
            "email_field": "input[type='email']",
            "password_field": "input[type='password']",
            "confirm_password": "input[name*='confirm']",
            "signup_button": "button[type='submit']",
            "login_link": "a[href*='login']"
        },
        "capabilities": ["fill_form", "submit_registration", "validate_inputs"],
        "next_actions": {
            "form_empty": "fill in email and password to create account",
            "form_partial": "complete remaining required fields",
            "form_complete": "submit registration to create account"
        }
    },
    "login": {
        "route": "/login",
        "context": "User authentication and login",
        "selectors": {
            "email_field": "input[type='email']",
            "password_field": "input[type='password']",
            "login_button": "button[type='submit']",
            "signup_link": "a[href*='signup']",
            "forgot_password": "a[href*='forgot']"
        },
        "capabilities": ["authenticate", "navigate_to_signup", "reset_password"],
        "next_actions": {
            "not_registered": "create new account or recover existing account",
            "forgot_password": "use password reset option",
            "ready_to_login": "enter credentials and sign in"
        }
    },
    "course_detail": {
        "route": "/course/",
        "context": "Individual course page with tasks and content",
        "selectors": {
            "join_button": "button:contains('Join')",
            "task_list": "[class*='task']",
            "submit_button": "button:contains('Submit')",
            "course_nav": "[class*='nav']"
        },
        "capabilities": ["join_course", "view_tasks", "submit_assignments", "navigate_content"],
        "next_actions": {
            "not_enrolled": "join course to access content and assignments",
            "enrolled": "view tasks, submit assignments, or access course materials",
            "task_pending": "complete and submit pending assignments"
        }
    },
    "admin_dashboard": {
        "route": "/school/admin",
        "context": "Administrative dashboard for course management",
        "selectors": {
            "create_course_btn": "button:contains('Create')",
            "course_list": "[class*='course']",
            "student_list": "[class*='student']",
            "analytics": "[class*='analytics']"
        },
        "capabilities": ["create_course", "manage_courses", "view_analytics", "manage_students"],
        "next_actions": {
            "no_courses": "create your first course to get started",
            "has_courses": "manage existing courses or create new ones",
            "view_analytics": "check course performance and student progress"
        }
    }
}

async def init_voice_tables():
    """Initialize voice-related database tables"""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        
        # Create voice_sessions table
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS voice_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_uuid TEXT UNIQUE NOT NULL,
                user_id TEXT,
                intent TEXT DEFAULT 'welcome',
                transcript TEXT DEFAULT '',
                completed BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create voice_interactions table for tracking conversation history
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS voice_interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_uuid TEXT,
                user_message TEXT,
                ai_response TEXT,
                intent TEXT,
                action_taken TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_uuid) REFERENCES voice_sessions(session_uuid)
            )
        """)
        
        # Create analytics events table
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS voice_analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                session_uuid TEXT,
                event_type TEXT NOT NULL,
                intent TEXT,
                slots TEXT,
                memory_snapshot TEXT,
                response_text TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create voice memory table for maintaining user context
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS voice_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE NOT NULL,
                memory_data TEXT,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        await conn.commit()

async def analyze_page_context(current_route: str, page_context: Dict[str, Any] = None) -> Dict[str, Any]:
    """Analyze current page context to provide intelligent assistance"""
    
    # Normalize route for matching
    route_key = "home"
    if current_route:
        if current_route == "/" or current_route == "/home":
            route_key = "home"
        elif "/signup" in current_route:
            route_key = "signup"
        elif "/login" in current_route:
            route_key = "login"
        elif "/course/" in current_route:
            route_key = "course_detail"
        elif "/school/admin" in current_route:
            route_key = "admin_dashboard"
    
    route_info = ROUTE_MAPPING.get(route_key, ROUTE_MAPPING["home"])
    
    # Analyze page state based on context
    page_state = "unknown"
    available_actions = []
    recommended_action = None
    
    if page_context:
        # Determine page state based on available elements and content
        if route_key == "home":
            has_courses = page_context.get("hasCourses", False)
            has_teaching = page_context.get("hasTeaching", False)
            has_learning = page_context.get("hasLearning", False)
            
            if not has_courses:
                page_state = "no_courses"
                available_actions = ["create_course", "browse_courses", "get_help"]
                recommended_action = "create your first course to get started"
            elif has_teaching and has_learning:
                page_state = "has_both"
                available_actions = ["create_course", "view_courses", "manage_courses"]
                recommended_action = "manage your existing courses or create a new one"
            elif has_teaching:
                page_state = "teaching_mode"
                available_actions = ["create_course", "manage_courses", "view_analytics"]
                recommended_action = "create a new course or manage existing ones"
            else:
                page_state = "learning_mode"
                available_actions = ["browse_courses", "join_course", "view_progress"]
                recommended_action = "browse and join new courses"
        
        elif route_key == "signup":
            form_filled = page_context.get("formFilled", 0)
            if form_filled == 0:
                page_state = "form_empty"
                recommended_action = "fill in your email and password to create an account"
            elif form_filled < 100:
                page_state = "form_partial"
                recommended_action = "complete the remaining required fields"
            else:
                page_state = "form_complete"
                recommended_action = "submit the form to create your account"
        
        elif route_key == "course_detail":
            is_enrolled = page_context.get("isEnrolled", False)
            has_tasks = page_context.get("hasTasks", False)
            
            if not is_enrolled:
                page_state = "not_enrolled"
                recommended_action = "join this course to access content and assignments"
            elif has_tasks:
                page_state = "has_tasks"
                recommended_action = "view and complete your assignments"
            else:
                page_state = "enrolled"
                recommended_action = "explore course content and materials"
    
    return {
        "route_key": route_key,
        "route_info": route_info,
        "page_state": page_state,
        "available_actions": available_actions,
        "recommended_action": recommended_action,
        "context_analysis": {
            "current_capabilities": route_info.get("capabilities", []),
            "suggested_next_steps": route_info.get("next_actions", {}).get(page_state, recommended_action),
            "available_selectors": route_info.get("selectors", {})
        }
    }

async def get_smart_openai_response(utterance: str, memory: Dict[str, Any], 
                                   current_route: str = None, page_context: Dict[str, Any] = None,
                                   user_id: str = None) -> Dict[str, Any]:
    """Enhanced OpenAI processing with full context awareness"""
    
    if not openai.api_key:
        return await process_intent_with_context(utterance, memory, current_route, page_context)
    
    try:
        # Analyze current page context
        context_analysis = await analyze_page_context(current_route, page_context)
        
        # Enhanced system prompt with context awareness
        system_prompt = f"""You are an intelligent voice assistant for SensAI, an educational platform. You have full awareness of the user's current page and context.

CURRENT CONTEXT:
- Page: {context_analysis['route_info']['context']}
- Route: {current_route or 'Unknown'}
- Page State: {context_analysis['page_state']}
- Available Actions: {', '.join(context_analysis['available_actions'])}
- Recommended Action: {context_analysis['recommended_action']}

CAPABILITIES ON THIS PAGE:
{', '.join(context_analysis['context_analysis']['current_capabilities'])}

INSTRUCTIONS:
1. Be contextually aware - understand what page the user is on and what they can do there
2. Provide specific, actionable guidance based on current page state
3. If user asks for something not available on current page, guide them to the right page
4. Use natural language understanding, not keyword matching
5. Be proactive - suggest next logical steps based on context
6. Handle ambiguous requests intelligently by inferring intent from context
7. Provide UI element targeting when actions are needed
8. When user asks to read page content, use the read_page intent to extract and summarize page information
9. When user asks about what to click or how to do something, use find_element intent to identify and highlight relevant UI elements

Respond conversationally and provide specific guidance for the current context."""
        
        user_prompt = f"""User said: "{utterance}"

Current Page Context:
- Route: {current_route}
- Page State: {context_analysis['page_state']}
- Page Data: {json.dumps(page_context, indent=2) if page_context else 'None'}

Previous Memory:
{json.dumps(memory, indent=2)}

What should I do to help this user? Consider their current context and provide specific, actionable guidance."""

        assistant_format = """Return a JSON object with:
{
  "intent": one of [navigate, highlight, click, form_fill, help, confirm, stop, read_page, find_element, unknown],
  "slots": key-value pairs with relevant extracted information,
  "responseText": conversational response explaining what you'll do,
  "memory": updated memory with new context,
  "action": {
    "type": "navigate|highlight|click|form_fill|speak",
    "target": "specific CSS selector or route",
    "message": "explanation of the action",
    "data": any additional data needed
  },
  "requiresConfirmation": boolean for important actions
}"""

        response = await openai.ChatCompletion.acreate(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": assistant_format}
            ],
            max_tokens=1000,
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        
        try:
            parsed_response = json.loads(ai_response)
            
            # Enhance the response with context-specific actions
            enhanced_action = await enhance_action_with_context(
                parsed_response.get("action", {}),
                context_analysis,
                parsed_response.get("intent", "unknown")
            )
            
            return {
                "intent": parsed_response.get("intent", "unknown"),
                "slots": parsed_response.get("slots", {}),
                "responseText": parsed_response.get("responseText", "I'm here to help!"),
                "memory": {
                    **memory,
                    **parsed_response.get("memory", {}),
                    "lastRoute": current_route,
                    "lastContext": context_analysis,
                    "lastInteraction": datetime.now().isoformat()
                },
                "action": enhanced_action,
                "requiresConfirmation": parsed_response.get("requiresConfirmation", False)
            }
            
        except json.JSONDecodeError:
            return await process_intent_with_context(utterance, memory, current_route, page_context)
            
    except Exception as e:
        print(f"OpenAI API error: {e}")
        return await process_intent_with_context(utterance, memory, current_route, page_context)

async def enhance_action_with_context(action: Dict[str, Any], context_analysis: Dict[str, Any], 
                                     intent: str) -> Optional[VoiceAction]:
    """Enhance actions with specific context and selectors"""
    
    if not action:
        return None
    
    action_type = action.get("type", "speak")
    selectors = context_analysis["context_analysis"]["available_selectors"]
    
    if action_type == "highlight" and action.get("target"):
        # Map generic targets to specific selectors
        target = action["target"]
        if target == "create_course_btn" and "create_course_btn" in selectors:
            action["target"] = selectors["create_course_btn"]
        elif target == "course_cards" and "course_cards" in selectors:
            action["target"] = selectors["course_cards"]
        elif target == "email_field" and "email_field" in selectors:
            action["target"] = selectors["email_field"]
    
    return VoiceAction(
        type=action_type,
        target=action.get("target"),
        message=action.get("message"),
        data=action.get("data")
    )

async def process_intent_with_context(utterance: str, memory: Dict[str, Any], 
                                     current_route: str = None, page_context: Dict[str, Any] = None) -> Dict[str, Any]:
    """Enhanced local processing with full context awareness"""
    
    utterance_lower = utterance.lower()
    context_analysis = await analyze_page_context(current_route, page_context)
    
    # Handle control commands
    if any(phrase in utterance_lower for phrase in ["stop", "quit", "cancel", "exit"]):
        return {
            "intent": "stop",
            "slots": {},
            "responseText": "Voice assistant stopped. You can restart by clicking the microphone button.",
            "memory": {**memory, "currentStep": "stopped"},
            "requiresConfirmation": False
        }
    
    # Context-aware help
    if any(phrase in utterance_lower for phrase in ["help", "what can i do", "guide me", "what now"]):
        recommended = context_analysis.get("recommended_action", "explore the current page")
        available = ", ".join(context_analysis.get("available_actions", ["browse", "navigate"]))
        
        return {
            "intent": "help",
            "slots": {"context": context_analysis["route_key"]},
            "responseText": f"You're on the {context_analysis['route_info']['context']}. I recommend you {recommended}. You can also {available}.",
            "memory": {**memory, "lastContext": context_analysis},
            "action": VoiceAction(type="speak", message=f"Here's what you can do on this page: {available}"),
            "requiresConfirmation": False
        }
    
    # Context-aware course creation
    if any(phrase in utterance_lower for phrase in ["create course", "new course", "make course", "add course"]):
        if context_analysis["route_key"] == "home":
            if context_analysis["page_state"] == "no_courses":
                response_text = "Perfect! This is exactly what you need to get started. Let me highlight the create course button for you."
                action = VoiceAction(type="highlight", target="create_course_btn", message="Click this button to create your first course")
            else:
                response_text = "I'll help you create a new course. Let me show you the create course button."
                action = VoiceAction(type="highlight", target="create_course_btn", message="Click here to create a new course")
        else:
            response_text = "To create a course, let me take you to the home page where you can access the course creation tools."
            action = VoiceAction(type="navigate", target="/", message="Navigating to home page for course creation")
        
        return {
            "intent": "create_course",
            "slots": {"action": "create_course", "context": context_analysis["route_key"]},
            "responseText": response_text,
            "memory": {**memory, "currentStep": "create_course", "lastContext": context_analysis},
            "action": action,
            "requiresConfirmation": False
        }
    
    # Smart course browsing based on context
    if any(phrase in utterance_lower for phrase in ["join course", "find course", "browse course", "enroll", "courses"]):
        if context_analysis["route_key"] == "home":
            if context_analysis["page_state"] == "no_courses":
                response_text = "It looks like there aren't any courses available yet. Would you like to create your first course instead?"
                action = VoiceAction(type="highlight", target="create_course_btn", message="Try creating a course first")
            else:
                response_text = "Great! I can see the available courses here. Let me highlight them for you."
                action = VoiceAction(type="highlight", target="course_cards", message="Here are the available courses")
        else:
            response_text = "Let me take you to the home page where you can browse and join courses."
            action = VoiceAction(type="navigate", target="/", message="Navigating to course browser")
        
        return {
            "intent": "browse_courses",
            "slots": {"action": "browse_courses", "context": context_analysis["route_key"]},
            "responseText": response_text,
            "memory": {**memory, "currentStep": "browse_courses", "lastContext": context_analysis},
            "action": action,
            "requiresConfirmation": False
        }
    
    # Intelligent account creation
    if any(phrase in utterance_lower for phrase in ["create account", "sign up", "register", "new account", "get started"]):
        if context_analysis["route_key"] == "signup":
            if context_analysis["page_state"] == "form_empty":
                response_text = "Perfect! You're on the signup page. Let me guide you through creating your account. First, click on the email field."
                action = VoiceAction(type="highlight", target="email_field", message="Start by entering your email address here")
            elif context_analysis["page_state"] == "form_partial":
                response_text = "I see you've started filling out the form. Let me help you complete the remaining fields."
                action = VoiceAction(type="highlight", target="password_field", message="Complete the form by filling this field")
            else:
                response_text = "Your form looks complete! You can now submit it to create your account."
                action = VoiceAction(type="highlight", target="signup_button", message="Click here to create your account")
        else:
            response_text = "I'll take you to the signup page where you can create your account."
            action = VoiceAction(type="navigate", target="/signup", message="Navigating to account creation")
        
        return {
            "intent": "create_account",
            "slots": {"action": "signup", "context": context_analysis["route_key"]},
            "responseText": response_text,
            "memory": {**memory, "currentStep": "create_account", "lastContext": context_analysis},
            "action": action,
            "requiresConfirmation": False
        }
    
    # Handle confirmations contextually
    if any(phrase in utterance_lower for phrase in ["yes", "yeah", "sure", "okay", "confirm", "do it"]):
        last_action = memory.get("lastSuggestedAction", context_analysis.get("recommended_action"))
        return {
            "intent": "confirm",
            "slots": {"confirmation": True, "context": context_analysis["route_key"]},
            "responseText": f"Great! Let me help you {last_action}.",
            "memory": {**memory, "lastConfirmation": True, "confirmedAction": last_action},
            "requiresConfirmation": False
        }
    
    # Default contextual response
    recommended = context_analysis.get("recommended_action", "explore this page")
    available_actions = context_analysis.get("available_actions", [])
    
    return {
        "intent": "contextual_help",
        "slots": {"context": context_analysis["route_key"], "page_state": context_analysis["page_state"]},
        "responseText": f"I'm not sure what you want to do with '{utterance}', but based on where you are, I recommend you {recommended}. You can also say: {', '.join(available_actions[:3])}.",
        "memory": {**memory, "lastContext": context_analysis, "lastUtterance": utterance},
        "action": VoiceAction(type="speak", message=f"Try saying: {', '.join(available_actions[:2])}"),
        "requiresConfirmation": False
    }
    """Get response from OpenAI for voice intent processing"""
    
    if not openai.api_key:
        return await process_intent_locally(utterance, memory)
    
    try:
        # Construct the prompt using the specified format
        system_prompt = """You are a helpful and structured voice assistant helping users onboard to an educational platform. Guide users through 3 steps: creating an account, joining a course, and submitting their first task. Maintain short-term memory and ask for missing details if needed. Confirm important actions. Always respond conversationally and clearly."""
        
        user_prompt = f"""Utterance: {utterance}

Previous Memory:
{json.dumps(memory, indent=2)}"""

        assistant_format = """Return a JSON object with:
{
  intent: one of [create_account, join_course, submit_task, confirm, repeat, stop, retry, unknown],
  slots: key-value pairs like { email, courseName, taskName },
  responseText: what to say back,
  memory: merged memory object
}"""

        response = await openai.ChatCompletion.acreate(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": assistant_format}
            ],
            max_tokens=800,
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        
        try:
            # Parse the JSON response
            parsed_response = json.loads(ai_response)
            
            # Ensure all required fields are present
            return {
                "intent": parsed_response.get("intent", "unknown"),
                "slots": parsed_response.get("slots", {}),
                "responseText": parsed_response.get("responseText", "I'm here to help you!"),
                "memory": parsed_response.get("memory", memory),
                "requiresConfirmation": parsed_response.get("requiresConfirmation", False)
            }
            
        except json.JSONDecodeError:
            # If AI doesn't return valid JSON, create a fallback response
            return {
                "intent": "unknown",
                "slots": {},
                "responseText": ai_response,
                "memory": memory,
                "requiresConfirmation": False
            }
            
    except Exception as e:
        print(f"OpenAI API error: {e}")
        return await process_intent_with_context(utterance, memory, current_route, page_context)

@router.on_event("startup")
async def startup_voice_system():
    """Initialize voice system on startup"""
    await init_voice_tables()

@router.post("/intent", response_model=VoiceIntentResponse)
async def process_voice_intent(request: VoiceIntentRequest):
    """Process voice input and return appropriate action with memory management"""
    try:
        user_id = request.userId or "anonymous"
        
        # Load existing memory for user
        memory = await load_user_memory(user_id)
        
        # Merge with request memory
        if request.memory:
            memory.update(request.memory)
        
        # Get AI response with full context
        ai_result = await get_smart_openai_response(
            request.utterance, 
            memory, 
            request.currentRoute, 
            request.pageContext, 
            user_id
        )
        
        # Update memory
        updated_memory = ai_result.get("memory", memory)
        await save_user_memory(user_id, updated_memory)
        
        # Create action based on intent with context awareness
        action = ai_result.get("action")
        if not action and ai_result["intent"] in ["create_course", "browse_courses", "create_account"]:
            # Fallback action creation for backward compatibility
            if ai_result["intent"] == "create_course":
                action = VoiceAction(type="highlight", target="create_course_btn", message="Create a new course")
            elif ai_result["intent"] == "browse_courses":
                action = VoiceAction(type="navigate", target="/", message="Browse available courses")
            elif ai_result["intent"] == "create_account":
                action = VoiceAction(type="navigate", target="/signup", message="Create your account")
        
        # Create response
        response = VoiceIntentResponse(
            intent=ai_result["intent"],
            slots=ai_result["slots"],
            responseText=ai_result["responseText"],
            memory=updated_memory,
            action=action,
            requiresConfirmation=ai_result.get("requiresConfirmation", False)
        )
        
        # Log analytics event
        await log_analytics_event(
            user_id=user_id,
            event_type="intent_processed",
            intent=ai_result["intent"],
            slots=ai_result["slots"],
            memory_snapshot=updated_memory,
            response_text=ai_result["responseText"]
        )
        
        # Log interaction
        try:
            async with get_new_db_connection() as conn:
                cursor = await conn.cursor()
                await cursor.execute("""
                    INSERT INTO voice_interactions (session_uuid, user_message, ai_response, intent, action_taken)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                user_id,  # Using user_id as session for now
                request.utterance,
                ai_result["responseText"],
                ai_result["intent"],
                json.dumps({"action": action.dict() if action else None})
                ))
                await conn.commit()
        except Exception as e:
            print(f"Failed to log interaction: {e}")
        
        return response
        
    except Exception as e:
        print(f"Error processing voice intent: {e}")
        # Return fallback response
        return VoiceIntentResponse(
            intent="error",
            slots={},
            responseText="I'm sorry, I encountered an error. Please try again.",
            memory=request.memory,
            action=VoiceAction(
                type="speak",
                message="I'm sorry, I encountered an error. Please try again."
            ),
            requiresConfirmation=False
        )

@router.post("/command")
async def process_voice_command(request: VoiceCommandRequest):
    """Handle voice control commands like stop, repeat, retry"""
    try:
        user_id = request.userId or "anonymous"
        memory = await load_user_memory(user_id)
        
        if request.memory:
            memory.update(request.memory)
        
        command = request.command.lower()
        
        if command == "stop":
            response_text = "Voice assistant stopped. You can restart anytime."
            memory["currentStep"] = "stopped"
        elif command == "repeat":
            response_text = memory.get("lastResponse", "I'm here to help you!")
        elif command == "retry":
            response_text = "Let's try that again. What would you like to do?"
            memory["currentStep"] = "welcome"
        else:
            response_text = "I didn't understand that command. Try 'stop', 'repeat', or 'retry'."
        
        await save_user_memory(user_id, memory)
        
        # Log command event
        await log_analytics_event(
            user_id=user_id,
            event_type="command_processed",
            intent=command,
            slots={"command": command},
            memory_snapshot=memory,
            response_text=response_text
        )
        
        return {
            "command": command,
            "responseText": response_text,
            "memory": memory
        }
        
    except Exception as e:
        print(f"Error processing voice command: {e}")
        return {
            "command": request.command,
            "responseText": "Error processing command.",
            "memory": request.memory
        }

@router.post("/log")
async def log_analytics(event: AnalyticsEvent):
    """Log analytics events from frontend"""
    try:
        await log_analytics_event(
            user_id=event.userId,
            event_type=event.eventType,
            intent=event.intent,
            slots=event.slots,
            memory_snapshot=event.memorySnapshot,
            response_text=event.responseText
        )
        return {"status": "logged"}
    except Exception as e:
        print(f"Error logging analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to log event")

# Helper functions for memory and analytics
async def load_user_memory(user_id: str) -> Dict[str, Any]:
    """Load user's memory from database"""
    try:
        async with get_new_db_connection() as conn:
            cursor = await conn.cursor()
            await cursor.execute("""
                SELECT memory_data FROM voice_memory WHERE user_id = ?
            """, (user_id,))
            
            result = await cursor.fetchone()
            if result:
                return json.loads(result[0])
            else:
                # Return default memory
                return {
                    "currentStep": "welcome",
                    "onboardingProgress": [],
                    "lastResponse": "Hi! I'm your SensAI assistant. I can help you create an account, join a course, or submit your first task."
                }
    except Exception as e:
        print(f"Error loading memory: {e}")
        return {
            "currentStep": "welcome",
            "onboardingProgress": [],
            "lastResponse": "Hi! I'm your SensAI assistant."
        }

async def save_user_memory(user_id: str, memory: Dict[str, Any]):
    """Save user's memory to database"""
    try:
        async with get_new_db_connection() as conn:
            cursor = await conn.cursor()
            await cursor.execute("""
                INSERT OR REPLACE INTO voice_memory (user_id, memory_data, last_updated)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            """, (user_id, json.dumps(memory)))
            await conn.commit()
    except Exception as e:
        print(f"Error saving memory: {e}")

async def log_analytics_event(user_id: str, event_type: str, intent: str = None, 
                            slots: Dict[str, Any] = None, memory_snapshot: Dict[str, Any] = None,
                            response_text: str = None):
    """Log analytics event to database"""
    try:
        async with get_new_db_connection() as conn:
            cursor = await conn.cursor()
            await cursor.execute("""
                INSERT INTO voice_analytics 
                (user_id, event_type, intent, slots, memory_snapshot, response_text, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                user_id,
                event_type,
                intent,
                json.dumps(slots) if slots else None,
                json.dumps(memory_snapshot) if memory_snapshot else None,
                response_text
            ))
            await conn.commit()
    except Exception as e:
        print(f"Error logging analytics: {e}")

@router.post("/sessions", response_model=dict)
async def create_voice_session(session_data: VoiceSessionCreate):
    """Create a new voice session"""
    try:
        async with get_new_db_connection() as conn:
            cursor = await conn.cursor()
            # Insert new voice session
            await cursor.execute("""
                INSERT INTO voice_sessions (session_uuid, user_id, intent, transcript, completed)
                VALUES (?, ?, ?, ?, ?)
            """, (session_data.session_uuid, session_data.user_id, session_data.intent, 
                session_data.transcript, session_data.completed))
            
            # Get the inserted record
            await cursor.execute("""
                SELECT id, session_uuid, user_id, intent, transcript, completed, created_at, updated_at
                FROM voice_sessions WHERE session_uuid = ?
            """, (session_data.session_uuid,))
            
            result = await cursor.fetchone()
            await conn.commit()
            
            if result:
                return {
                    "status": "success",
                    "session": {
                        "id": result[0],
                        "session_uuid": result[1], 
                        "user_id": result[2],
                        "intent": result[3],
                        "transcript": result[4],
                        "completed": result[5],
                        "created_at": result[6],
                        "updated_at": result[7]
                    },
                    "message": "Voice session created successfully"
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to create voice session")
                
    except Exception as e:
        print(f"Error creating voice session: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/memory/{user_id}")
async def get_user_memory(user_id: str):
    """Get user's current memory state"""
    try:
        memory = await load_user_memory(user_id)
        return {"user_id": user_id, "memory": memory}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving memory: {str(e)}")

@router.get("/analytics/{user_id}")
async def get_user_analytics(user_id: str):
    """Get user's voice analytics history"""
    try:
        async with get_new_db_connection() as conn:
            cursor = await conn.cursor()
            await cursor.execute("""
                SELECT event_type, intent, slots, response_text, timestamp
                FROM voice_analytics 
                WHERE user_id = ? 
                ORDER BY timestamp DESC
                LIMIT 50
            """, (user_id,))
            
            results = await cursor.fetchall()
            events = []
            for row in results:
                events.append({
                    "event_type": row[0],
                    "intent": row[1],
                    "slots": json.loads(row[2]) if row[2] else {},
                    "response_text": row[3],
                    "timestamp": row[4]
                })
            
            return {"user_id": user_id, "events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving analytics: {str(e)}")

"""
Intelligent Voice Route with OpenAI Integration
Provides context-aware voice assistance with fallback responses
"""

import os
import logging
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import openai

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key or openai_api_key.startswith("sk-") and len(openai_api_key) < 20:
    logger.warning("OpenAI API key not properly configured. Please set a valid OPENAI_API_KEY in .env file")
    openai_api_key = None
else:
    openai.api_key = openai_api_key
    logger.info("OpenAI API key configured successfully")

router = APIRouter()

class PageContent(BaseModel):
    url: str
    title: Optional[str] = ""
    text_content: Optional[str] = ""
    elements: Optional[List[str]] = []
    context: Optional[Dict[str, Any]] = {}

class ConversationMessage(BaseModel):
    role: str
    content: str

class VoiceAction(BaseModel):
    type: str
    target: Optional[str] = None
    message: Optional[str] = None

class IntelligentVoiceRequest(BaseModel):
    message: str
    page_content: PageContent
    conversation_history: Optional[List[ConversationMessage]] = []

class PageAnalysisRequest(BaseModel):
    page_data: Dict[str, Any]
    analysis_type: str = "comprehensive"

class PageAnalysisResponse(BaseModel):
    summary: str
    keyElements: List[Dict[str, Any]]
    userIntent: List[str]
    nextSteps: List[str]
    accessibility: Dict[str, Any]

class IntelligentVoiceResponse(BaseModel):
    response: str
    actions: Optional[List[VoiceAction]] = []
    confidence: float = 0.0
    page_analysis: Optional[Dict[str, Any]] = None
    suggestions: Optional[List[str]] = []

def generate_context_aware_response(request: IntelligentVoiceRequest) -> IntelligentVoiceResponse:
    """Generate intelligent responses based on page context and user input"""
    
    message = request.message.lower()
    url = request.page_content.url
    page_title = request.page_content.title or ""
    page_text = request.page_content.text_content or ""
    
    # Initialize response
    response_text = "I'm here to help! "
    actions = []
    confidence = 0.7
    
    # Account/Login detection
    if any(keyword in message for keyword in ['account', 'sign up', 'signup', 'register', 'login', 'sign in', 'join']):
        if '/login' in url:
            response_text = "I can see you want to create an account. Look for the 'Sign in with Google' button that I've highlighted for you. Click it to get started quickly and securely!"
            actions = [{
                "type": "highlight",
                "target": "#google-signin-button",
                "message": "Highlighting the Google sign-in button"
            }]
            confidence = 0.95
        else:
            response_text = "I'll take you to the login page where you can create an account with Google. It's quick and secure!"
            actions = [{
                "type": "navigate",
                "target": "/login",
                "message": "Redirecting to login page"
            }]
            confidence = 0.9
    
    # Course-related queries
    elif any(keyword in message for keyword in ['course', 'class', 'learn', 'study', 'lesson']):
        if 'create' in message or 'make' in message or 'new' in message:
            response_text = "I can help you create a new course! Look for the 'Create Course' button on your dashboard. Would you like me to guide you through the process?"
            confidence = 0.85
        else:
            response_text = "I can help you with courses! You can create courses, enroll in existing ones, or manage your learning progress. What would you like to do?"
            confidence = 0.8
    
    # Navigation help
    elif any(keyword in message for keyword in ['where', 'how', 'what should i click', 'help me', 'guide me']):
        if '/login' in url:
            response_text = "You're on the login page. To get started, click the 'Sign in with Google' button. This will create your account and get you logged in securely."
            actions = [{
                "type": "highlight",
                "target": "#google-signin-button",
                "message": "Highlighting the Google sign-in button"
            }]
            confidence = 0.9
        elif '/dashboard' in url or url == '/':
            response_text = "Welcome to your dashboard! From here you can create new courses, view your enrolled courses, or manage your learning. What would you like to do first?"
            confidence = 0.8
        else:
            response_text = "I can help you navigate the platform. You can create accounts, manage courses, and access learning materials. What specific task would you like help with?"
            confidence = 0.7
    
    # General help
    elif any(keyword in message for keyword in ['help', 'what can you do', 'assist', 'support']):
        response_text = "I'm your SensAI voice assistant! I can help you:\n• Create and manage accounts\n• Navigate the platform\n• Create and enroll in courses\n• Highlight elements on the page\n• Answer questions about features\n\nJust tell me what you'd like to do!"
        confidence = 0.85
    
    # Fallback for unrecognized queries
    else:
        response_text = f"I understand you're asking about '{request.message}'. I'm here to help with account creation, course management, and navigation. Could you be more specific about what you'd like to do?"
        confidence = 0.5
    
    return IntelligentVoiceResponse(
        response=response_text,
        actions=actions,
        confidence=confidence,
        page_analysis={
            "is_guided_journey": True,
            "journey_type": "voice_assistance",
            "current_page": url,
            "suggested_actions": ["create_account", "explore_courses", "get_help"]
        },
        suggestions=[
            "Create an account",
            "Browse courses", 
            "Get started",
            "Tell me what you can do"
        ]
    )

async def get_openai_response(request: IntelligentVoiceRequest) -> IntelligentVoiceResponse:
    """Get intelligent response from OpenAI API"""
    
    try:
        # Prepare context for OpenAI
        system_prompt = f"""You are SensAI, a helpful voice assistant for an educational platform. 
        
Current page: {request.page_content.url}
Page title: {request.page_content.title}
Available elements: {', '.join(request.page_content.elements)}
Page context: This is an educational platform where users can create accounts, join courses, and learn.

Your role is to:
1. Help users navigate the platform
2. Guide them through account creation and course enrollment  
3. Answer questions about features
4. Suggest specific actions they can take

If the user mentions anything about accounts, signing up, or getting started, guide them to create an account.
If they're on the login page (/login), tell them to click the 'Sign in with Google' button.
If they're asking about courses, help them understand how to create or join courses.

Keep responses conversational, helpful, and under 2 sentences when possible.
Focus on actionable guidance rather than general information.
"""

        # Prepare conversation history
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history
        for msg in request.conversation_history[-5:]:  # Last 5 messages for context
            messages.append({"role": msg.role, "content": msg.content})
        
        # Add current message
        messages.append({"role": "user", "content": request.message})
        
        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=150,
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content.strip()
        
        # Generate actions based on response content
        actions = []
        if any(keyword in ai_response.lower() for keyword in ['sign in with google', 'google button', 'login button']):
            actions.append({
                "type": "highlight",
                "target": "#google-signin-button", 
                "message": "Highlighting the Google sign-in button"
            })
        elif 'login page' in ai_response.lower() and '/login' not in request.page_content.url:
            actions.append({
                "type": "navigate",
                "target": "/login",
                "message": "Redirecting to login page"
            })
        
        return IntelligentVoiceResponse(
            response=ai_response,
            actions=actions,
            confidence=0.9,
            page_analysis={
                "is_guided_journey": True,
                "journey_type": "ai_powered_assistance",
                "current_page": request.page_content.url
            }
        )
        
    except Exception as e:
        logger.error(f"OpenAI API error: {str(e)}")
        # Fall back to context-aware response
        return generate_context_aware_response(request)

@router.post("/analyze-page", response_model=PageAnalysisResponse)
async def analyze_page_with_openai(request: PageAnalysisRequest):
    """
    Analyze page structure and content using OpenAI for detailed insights
    """
    
    try:
        logger.info(f"Analyzing page: {request.page_data.get('url', 'unknown')}")
        
        if openai_api_key:
            # Prepare detailed analysis prompt
            system_prompt = """You are an expert UX/UI analyst and accessibility specialist. 
            Analyze the provided page data and return structured insights about:
            1. Page purpose and user goals
            2. Key interactive elements and their importance
            3. Accessibility considerations
            4. Suggested user actions
            
            Focus on practical, actionable insights for voice assistance."""
            
            page_data = request.page_data
            
            user_prompt = f"""
            Analyze this page:
            URL: {page_data.get('url', '')}
            Title: {page_data.get('title', '')}
            
            Content Structure:
            - Headings: {page_data.get('content', {}).get('headings', [])}
            - Buttons: {page_data.get('content', {}).get('buttons', [])}
            - Forms: {page_data.get('content', {}).get('forms', [])}
            - Links: {page_data.get('content', {}).get('links', [])}
            
            Page Type: {page_data.get('analysis', {}).get('pageType', 'unknown')}
            Complexity: {page_data.get('analysis', {}).get('complexity', 'unknown')}
            
            Text Content (first 500 chars): {page_data.get('content', {}).get('text', '')[:500]}
            
            Provide analysis in this format:
            1. Brief summary of page purpose
            2. List of key elements with importance (high/medium/low)
            3. Likely user intents
            4. Recommended next steps
            5. Accessibility assessment with score 1-10
            """
            
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=500,
                temperature=0.3
            )
            
            ai_analysis = response.choices[0].message.content.strip()
            
            # Parse the AI response (simplified parsing)
            return PageAnalysisResponse(
                summary=ai_analysis[:200] + "..." if len(ai_analysis) > 200 else ai_analysis,
                keyElements=[
                    {
                        "type": "button",
                        "text": btn,
                        "purpose": "User interaction",
                        "importance": "high" if any(word in btn.lower() for word in ['sign', 'create', 'submit', 'start']) else "medium"
                    }
                    for btn in page_data.get('content', {}).get('buttons', [])[:5]
                ],
                userIntent=[
                    "Navigate the platform",
                    "Complete tasks",
                    "Access information"
                ],
                nextSteps=[
                    "Click primary action button",
                    "Fill out forms if present",
                    "Navigate to relevant sections"
                ],
                accessibility={
                    "score": 7,
                    "issues": ["Consider adding more descriptive labels"],
                    "recommendations": ["Ensure keyboard navigation", "Add ARIA labels"]
                }
            )
        else:
            # Fallback analysis without OpenAI
            page_data = request.page_data
            return PageAnalysisResponse(
                summary=f"This appears to be a {page_data.get('analysis', {}).get('pageType', 'web')} page with {len(page_data.get('content', {}).get('buttons', []))} interactive elements.",
                keyElements=[
                    {
                        "type": "button",
                        "text": btn,
                        "purpose": "User interaction",
                        "importance": "medium"
                    }
                    for btn in page_data.get('content', {}).get('buttons', [])[:3]
                ],
                userIntent=["Complete primary tasks", "Navigate content"],
                nextSteps=["Interact with available buttons", "Read page content"],
                accessibility={
                    "score": 6,
                    "issues": ["Limited analysis without AI"],
                    "recommendations": ["Use voice commands for navigation"]
                }
            )
            
    except Exception as e:
        logger.error(f"Error analyzing page: {str(e)}")
        raise HTTPException(status_code=500, detail="Page analysis failed")

@router.post("/intelligent-voice", response_model=IntelligentVoiceResponse)
async def process_intelligent_voice(request: IntelligentVoiceRequest):
    """
    Process voice input with intelligent context-aware responses
    Uses OpenAI API when available, falls back to rule-based responses
    """
    
    try:
        logger.info(f"Processing voice input: {request.message}")
        logger.info(f"Page context: {request.page_content.url}")
        
        if openai_api_key:
            # Try OpenAI first for more intelligent responses
            logger.info("Using OpenAI API for intelligent response")
            response = await get_openai_response(request)
        else:
            # Fallback to context-aware rule-based response
            logger.info("Using context-aware fallback response")
            response = generate_context_aware_response(request)
        
        logger.info(f"Generated response: {response.response}")
        return response
        
    except Exception as e:
        logger.error(f"Error processing intelligent voice request: {str(e)}")
        # Ultimate fallback
        return IntelligentVoiceResponse(
            response="I'm having trouble processing your request right now, but I'm here to help! Try asking about creating an account, joining courses, or navigating the platform.",
            confidence=0.3
        )

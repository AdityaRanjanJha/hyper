/**
 * Voice API client for enhanced voice onboarding system with context awareness
 */

// Define memory structure
export interface VoiceMemory {
  currentStep: string;
  onboardingProgress: string[];
  lastResponse: string;
  [key: string]: unknown;
}

// Define slots structure
export interface VoiceSlots {
  email?: string;
  courseName?: string;
  taskName?: string;
  action?: string;
  confirmation?: boolean;
  [key: string]: unknown;
}

export interface VoiceIntentRequest {
  userId: string;
  utterance: string;
  memory: VoiceMemory;
  currentRoute?: string;
  pageContext?: {
    hasCourses?: boolean;
    hasTeaching?: boolean;
    hasLearning?: boolean;
    isEnrolled?: boolean;
    hasTasks?: boolean;
    formFilled?: number;
    availableElements?: string[];
  };
}

export interface VoiceCommandRequest {
  userId?: string;
  command: string;
  memory?: VoiceMemory;
}

export interface VoiceAction {
  type: 'navigate' | 'highlight' | 'speak' | 'form_fill' | 'click' | 'confirm';
  target?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export interface VoiceIntentResponse {
  intent: string;
  slots: VoiceSlots;
  responseText: string;
  memory: VoiceMemory;
  action?: VoiceAction;
  requiresConfirmation: boolean;
}

export interface VoiceCommandResponse {
  command: string;
  responseText: string;
  memory: VoiceMemory;
}

export interface AnalyticsEvent {
  userId: string;
  eventType: string;
  intent?: string;
  slots?: VoiceSlots;
  memorySnapshot?: VoiceMemory;
  responseText?: string;
}

export interface AnalyticsHistoryEvent {
  event_type: string;
  intent: string;
  slots: VoiceSlots;
  response_text: string;
  timestamp: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Enhanced voice processing with OpenAI fallback
export async function processVoiceIntentWithOpenAI(request: VoiceIntentRequest): Promise<VoiceIntentResponse> {
  try {
    // Try the original voice intent API first
    const response = await fetch(`${API_BASE}/voice/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (response.ok) {
      return response.json();
    } else {
      throw new Error(`Voice intent API error: ${response.status}`);
    }
  } catch (error) {
    console.log('Voice intent API failed, trying OpenAI fallback:', error);
    
    // Fallback to OpenAI-powered intelligent response
    try {
      const intelligentResponse = await fetch(`${API_BASE}/intelligent-voice/intelligent-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: request.utterance,
          page_content: {
            url: request.currentRoute || window.location.pathname,
            title: document.title,
            text_content: document.body.innerText.slice(0, 1000), // First 1000 chars
            elements: request.pageContext?.availableElements || [],
            context: request.pageContext
          },
          conversation_history: []
        }),
      });

      if (intelligentResponse.ok) {
        const aiData = await intelligentResponse.json();
        
        // Convert OpenAI response to VoiceIntentResponse format
        return {
          intent: 'intelligent_response',
          slots: {},
          responseText: aiData.response || "I understand what you're asking. Let me help you with that.",
          memory: request.memory,
          requiresConfirmation: false,
          action: aiData.actions && aiData.actions.length > 0 ? {
            type: aiData.actions[0].type,
            target: aiData.actions[0].target,
            message: aiData.actions[0].message
          } : undefined
        };
      } else {
        throw new Error('OpenAI API also failed');
      }
    } catch (openaiError) {
      console.log('OpenAI API also failed:', openaiError);
      
      // Final fallback with context-aware response
      const contextualResponse = generateContextualFallback(request);
      return contextualResponse;
    }
  }
}

// Generate intelligent fallback responses based on context
function generateContextualFallback(request: VoiceIntentRequest): VoiceIntentResponse {
  const utterance = request.utterance.toLowerCase();
  const route = request.currentRoute || '';
  
  let responseText = "I'm here to help! ";
  let intent = 'general_help';
  let action: VoiceAction | undefined = undefined;
  
  // Context-aware responses
  if (route.includes('/login')) {
    if (utterance.includes('account') || utterance.includes('sign') || utterance.includes('create')) {
      responseText = "To create an account, click the 'Sign in with Google' button. This will set up your account quickly and securely.";
      intent = 'account_creation';
      action = {
        type: 'highlight',
        target: '#google-signin-button',
        message: 'Highlighting the Google sign-in button'
      };
    } else {
      responseText = "You're on the login page. You can create an account using the Google sign-in button, or let me know what specific help you need.";
    }
  } else if (route.includes('/dashboard') || route === '/') {
    if (utterance.includes('course')) {
      responseText = "I can help you with courses! You can create a new course, view your existing courses, or enroll in new ones. What would you like to do?";
      intent = 'course_help';
    } else if (utterance.includes('create')) {
      responseText = "You can create a new course by clicking the 'Create Course' button. I can guide you through the process!";
      intent = 'create_course';
    } else {
      responseText = "Welcome to your dashboard! You can create courses, manage your learning, and explore available courses. What would you like to do?";
    }
  } else {
    // General responses based on keywords
    if (utterance.includes('help')) {
      responseText = "I'm your SensAI voice assistant! I can help you navigate the platform, create accounts, manage courses, and answer questions. What do you need help with?";
    } else if (utterance.includes('course')) {
      responseText = "I can help you with course-related tasks. You can create courses, enroll in courses, or manage your learning progress.";
    } else if (utterance.includes('account') || utterance.includes('sign')) {
      responseText = "To create an account or sign in, I can take you to the login page where you can use Google authentication.";
      action = {
        type: 'navigate',
        target: '/login',
        message: 'Taking you to the login page'
      };
    } else {
      responseText = "I understand you want help with the platform. I can assist with creating accounts, managing courses, and navigating the interface. Could you be more specific about what you'd like to do?";
    }
  }
  
  return {
    intent,
    slots: {},
    responseText,
    memory: request.memory,
    requiresConfirmation: false,
    action
  };
}

export async function processVoiceIntent(request: VoiceIntentRequest): Promise<VoiceIntentResponse> {
  const response = await fetch(`${API_BASE}/voice/intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Voice intent API error: ${response.status}`);
  }

  return response.json();
}

export async function processVoiceCommand(request: VoiceCommandRequest): Promise<VoiceCommandResponse> {
  const response = await fetch(`${API_BASE}/voice/command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Voice command API error: ${response.status}`);
  }

  return response.json();
}

export async function logAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/voice/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...event,
        timestamp: new Date(),
      }),
    });

    if (!response.ok) {
      console.warn('Failed to log analytics event:', response.status);
    }
  } catch (error) {
    console.warn('Analytics logging failed:', error);
  }
}

export async function getUserMemory(userId: string): Promise<VoiceMemory> {
  const response = await fetch(`${API_BASE}/voice/memory/${userId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Memory API error: ${response.status}`);
  }

  const data = await response.json();
  return data.memory;
}

export async function getUserAnalytics(userId: string): Promise<AnalyticsHistoryEvent[]> {
  const response = await fetch(`${API_BASE}/voice/analytics/${userId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Analytics API error: ${response.status}`);
  }

  const data = await response.json();
  return data.events;
}

// Context analysis utilities
export function analyzePageContext(route: string): {
  hasCourses: boolean;
  hasTeaching: boolean;
  hasLearning: boolean;
  availableElements: string[];
} {
  const elements: string[] = [];
  
  // Add route-based context
  if (route.includes('/login')) {
    elements.push("google_signin_btn");
  }
  if (route.includes('/dashboard') || route === '/') {
    elements.push("dashboard_elements");
  }
  
  // Detect available elements on the page
  if (document.querySelector("button:contains('Create course')")) {
    elements.push("create_course_btn");
  }
  if (document.querySelectorAll("[class*='course']").length > 0) {
    elements.push("course_cards");
  }
  if (document.querySelector("button:contains('Created by you')")) {
    elements.push("teaching_tab");
  }
  if (document.querySelector("button:contains('Enrolled courses')")) {
    elements.push("learning_tab");
  }
  
  return {
    hasCourses: elements.includes("course_cards"),
    hasTeaching: elements.includes("teaching_tab"),
    hasLearning: elements.includes("learning_tab"),
    availableElements: elements
  };
}

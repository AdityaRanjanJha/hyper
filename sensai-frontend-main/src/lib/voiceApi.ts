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

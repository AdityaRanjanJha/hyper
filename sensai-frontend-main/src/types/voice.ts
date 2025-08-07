/**
 * Voice Onboarding Types
 * 
 * TypeScript definitions for the voice onboarding system
 */

export type OnboardingStep = 
  | 'welcome'
  | 'signup' 
  | 'join-course'
  | 'first-submission'
  | 'complete'
  | 'idle'
  | 'signup_prompt'
  | 'signup_form'
  | 'course_selection'
  | 'first_submission'
  | 'completed';

export type VoiceIntent = 
  | 'signup'
  | 'join_course'
  | 'submit_assignment'
  | 'help'
  | 'repeat'
  | 'stop'
  | 'read_page'
  | 'find_element'
  | 'unknown';

export interface VoiceSession {
  id?: string;
  user_id?: number;
  session_uuid: string;
  intent: string;
  transcript: string;
  completed: boolean;
  step_data?: Record<string, unknown>;
  created_at?: string;
}

export interface VoiceOnboardingState {
  isActive: boolean;
  currentStep: OnboardingStep;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  sessionId: string | null;
  completedSteps: OnboardingStep[];
  errorMessage: string | null;
  error: string | null;
  isMuted: boolean;
}

export interface VoiceOnboardingAgentProps {
  isActive: boolean;
  currentStep: OnboardingStep;
  onStepComplete: (step: OnboardingStep, data?: Record<string, unknown>) => void;
  onToggleVoice: () => void;
  onError?: (error: string) => void;
}

export interface VoiceOnboardingContextType {
  state: VoiceOnboardingState;
  startOnboarding: () => void;
  stopOnboarding: () => void;
  setAgentActive: (active: boolean) => void;
  processUserInput: (transcript: string) => Promise<void>;
  completeStep: (step: OnboardingStep) => void;
  reset: () => void;
  toggleMute: () => void;
}

export interface IntentProcessingRequest {
  transcript: string;
  context: {
    currentStep: OnboardingStep;
    currentUrl: string;
    userHasCourses: boolean;
    userIsAuthenticated: boolean;
  };
}

export interface IntentProcessingResponse {
  intent: VoiceIntent;
  confidence: number;
  action: {
    type: 'navigate' | 'highlight' | 'speak' | 'form_fill' | 'click';
    target?: string;
    data?: Record<string, unknown>;
    message?: string;
  };
  next_step?: OnboardingStep;
}

export interface VoiceAnalytics {
  total_sessions: number;
  completed_sessions: number;
  completion_rate: number;
  average_completion_time: number;
  step_completion_rates: Record<OnboardingStep, number>;
  common_intents: Array<{
    intent: string;
    count: number;
  }>;
}

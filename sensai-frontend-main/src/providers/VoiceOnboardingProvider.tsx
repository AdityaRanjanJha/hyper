"use client";

/**
 * Voice Onboarding Context Provider
 * 
 * Manages th    case 'SET_ERROR':
      return { ...state, error: action.payload, errorMessage: action.payload };
    case 'TOGGLE_MUTE':
      return { ...state, isMuted: !state.isMuted };
    case 'RESET':
      return initialState;
    default:
        // Toggle mute
  const toggleMute = useCallback(() => {
    dispatch({ type: 'TOGGLE_MUTE' });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      stopSpeaking();
      removeAllHighlights();
    };
  }, []);

  const contextValue: VoiceOnboardingContextType = {
    state,
    startOnboarding,
    stopOnboarding,
    setAgentActive,
    processUserInput,
    completeStep,
    reset,
    toggleMute
  };tate for the voice onboarding system
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  VoiceOnboardingState, 
  VoiceOnboardingContextType, 
  OnboardingStep, 
  VoiceIntent 
} from '@/types/voice';
import { 
  speak, 
  stopSpeaking, 
  recognizeIntent, 
  generateSessionUUID, 
  getStepInstructions, 
  highlightElement, 
  removeAllHighlights,
  createPageSummary 
} from '@/lib/voiceUtils';
import { createVoiceSession, processVoiceIntent } from '@/lib/api';

// Initial state
const initialState: VoiceOnboardingState = {
  isActive: false,
  currentStep: 'idle',
  isListening: false,
  isSpeaking: false,
  transcript: '',
  sessionId: null,
  completedSteps: [],
  errorMessage: null,
  error: null,
  isMuted: false
};

// Action types
type VoiceOnboardingAction =
  | { type: 'SET_ACTIVE'; payload: boolean }
  | { type: 'SET_STEP'; payload: OnboardingStep }
  | { type: 'SET_LISTENING'; payload: boolean }
  | { type: 'SET_SPEAKING'; payload: boolean }
  | { type: 'SET_TRANSCRIPT'; payload: string }
  | { type: 'SET_SESSION_ID'; payload: string | null }
  | { type: 'ADD_COMPLETED_STEP'; payload: OnboardingStep }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'RESET' };

// Reducer
const voiceOnboardingReducer = (
  state: VoiceOnboardingState,
  action: VoiceOnboardingAction
): VoiceOnboardingState => {
  switch (action.type) {
    case 'SET_ACTIVE':
      return { ...state, isActive: action.payload };
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_LISTENING':
      return { ...state, isListening: action.payload };
    case 'SET_SPEAKING':
      return { ...state, isSpeaking: action.payload };
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.payload };
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };
    case 'ADD_COMPLETED_STEP':
      return {
        ...state,
        completedSteps: [...state.completedSteps, action.payload]
      };
    case 'SET_ERROR':
      return { ...state, errorMessage: action.payload };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
};

// Create context
const VoiceOnboardingContext = createContext<VoiceOnboardingContextType | undefined>(undefined);

// Provider component
interface VoiceOnboardingProviderProps {
  children: React.ReactNode;
}

export const VoiceOnboardingProvider: React.FC<VoiceOnboardingProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(voiceOnboardingReducer, initialState);
  const router = useRouter();
  const { data: session } = useSession();

  // Start onboarding
  const startOnboarding = useCallback(async () => {
    try {
      console.log('🎯 STARTING ONBOARDING:', {
        timestamp: new Date().toISOString(),
        sessionUser: session?.user,
        currentState: state
      });
      
      dispatch({ type: 'SET_ACTIVE', payload: true });
      dispatch({ type: 'SET_STEP', payload: 'welcome' });
      dispatch({ type: 'SET_ERROR', payload: null });

      // Generate session ID
      const sessionId = generateSessionUUID();
      dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
      
      console.log('🎯 Generated session ID:', sessionId);

      // Create voice session in backend
      if (session?.user?.id) {
        console.log('🎯 Creating voice session in backend...');
        const sessionData = {
          session_uuid: sessionId,
          user_id: parseInt(session.user.id),
          intent: 'welcome',
          transcript: '',
          completed: false
        };
        console.log('🎯 Session data:', sessionData);
        
        await createVoiceSession(sessionData);
        console.log('🎯 Voice session created successfully');
      }

      // Speak welcome message
      const welcomeMessage = getStepInstructions('welcome');
      console.log('🔊 SPEAKING:', welcomeMessage);
      dispatch({ type: 'SET_SPEAKING', payload: true });
      await speak(welcomeMessage);
      dispatch({ type: 'SET_SPEAKING', payload: false });
      console.log('🔊 Finished speaking welcome message');

    } catch (error) {
      console.error('❌ Error starting onboarding:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to start voice assistant' });
    }
  }, [session?.user, state]);

  // Stop onboarding
  const stopOnboarding = useCallback(() => {
    stopSpeaking();
    removeAllHighlights();
    dispatch({ type: 'SET_ACTIVE', payload: false });
    dispatch({ type: 'SET_LISTENING', payload: false });
    dispatch({ type: 'SET_SPEAKING', payload: false });
    dispatch({ type: 'SET_STEP', payload: 'idle' });
  }, []);

  // Set agent active state
  const setAgentActive = useCallback((active: boolean) => {
    if (active) {
      startOnboarding();
    } else {
      stopOnboarding();
    }
  }, [startOnboarding, stopOnboarding]);

  // Execute voice action from backend
  const executeVoiceAction = useCallback(async (response: {
    intent: VoiceIntent;
    action: {
      type: 'navigate' | 'highlight' | 'speak' | 'form_fill' | 'click';
      target?: string;
      message?: string;
    };
    next_step?: OnboardingStep;
  }) => {
    try {
      console.log('⚡ EXECUTING ACTION:', {
        timestamp: new Date().toISOString(),
        response
      });
      
      // Execute the action
      switch (response.action.type) {
        case 'navigate':
          if (response.action.target) {
            console.log('🧭 Navigating to:', response.action.target);
            router.push(response.action.target);
          }
          break;

        case 'highlight':
          if (response.action.target) {
            console.log('🎯 Highlighting element:', response.action.target);
            removeAllHighlights();
            highlightElement(response.action.target);
          }
          break;

        case 'speak':
          if (response.action.message) {
            console.log('🔊 SPEAKING ACTION MESSAGE:', response.action.message);
            dispatch({ type: 'SET_SPEAKING', payload: true });
            await speak(response.action.message);
            dispatch({ type: 'SET_SPEAKING', payload: false });
          }
          break;

        case 'click':
          if (response.action.target) {
            console.log('👆 Clicking element:', response.action.target);
            const element = document.querySelector(response.action.target) as HTMLElement;
            if (element) {
              element.click();
            } else {
              console.warn('❌ Element not found for clicking:', response.action.target);
            }
          }
          break;

        case 'form_fill':
          console.log('📝 Form fill action (not implemented)');
          // Implementation for form filling would go here
          break;
      }

      // Update step if provided
      if (response.next_step) {
        console.log('➡️ Moving to next step:', response.next_step);
        dispatch({ type: 'SET_STEP', payload: response.next_step });
        
        // Speak instructions for next step
        const nextInstructions = getStepInstructions(response.next_step);
        console.log('🔊 SPEAKING NEXT STEP:', nextInstructions);
        dispatch({ type: 'SET_SPEAKING', payload: true });
        await speak(nextInstructions);
        dispatch({ type: 'SET_SPEAKING', payload: false });
      }

    } catch (error) {
      console.error('❌ Error executing voice action:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to execute action' });
    }
  }, [router]);

  // Process user input
  const processUserInput = useCallback(async (transcript: string) => {
    try {
      console.log('🧠 PROCESSING USER INPUT:', {
        timestamp: new Date().toISOString(),
        transcript,
        currentStep: state.currentStep,
        isActive: state.isActive
      });
      
      dispatch({ type: 'SET_TRANSCRIPT', payload: transcript });
      dispatch({ type: 'SET_ERROR', payload: null });

      // Recognize intent locally first
      const localIntent = recognizeIntent(transcript);
      console.log('🧠 Local intent recognized:', localIntent);
      console.log('🔍 Full transcript for intent matching:', transcript.toLowerCase());

      // Handle common intents locally
      if (localIntent === 'help') {
        const helpMessage = getStepInstructions(state.currentStep);
        console.log('🔊 SPEAKING HELP:', helpMessage);
        dispatch({ type: 'SET_SPEAKING', payload: true });
        await speak(helpMessage);
        dispatch({ type: 'SET_SPEAKING', payload: false });
        return;
      }

      if (localIntent === 'repeat') {
        const currentMessage = getStepInstructions(state.currentStep);
        console.log('🔊 REPEATING:', currentMessage);
        dispatch({ type: 'SET_SPEAKING', payload: true });
        await speak(currentMessage);
        dispatch({ type: 'SET_SPEAKING', payload: false });
        return;
      }

      if (localIntent === 'stop') {
        console.log('🛑 Stopping onboarding via voice command');
        stopOnboarding();
        return;
      }

      if (localIntent === 'read_page') {
        console.log('📖 Reading page content - LOCAL PROCESSING');
        const pageSummary = createPageSummary();
        const message = `Here's what I can see on this page: ${pageSummary}`;
        
        dispatch({ type: 'SET_SPEAKING', payload: true });
        await speak(message);
        dispatch({ type: 'SET_SPEAKING', payload: false });
        return;
      }

      // For complex intents, use backend processing
      if (localIntent === 'unknown' || localIntent === 'signup' || localIntent === 'join_course' || localIntent === 'submit_assignment') {
        const context = {
          currentStep: state.currentStep,
          currentUrl: window.location.pathname,
          userHasCourses: false, // This would be determined from app state
          userIsAuthenticated: !!session
        };
        
        console.log('🌐 BACKEND PROCESSING:', {
          intent: localIntent,
          context,
          transcript
        });

        const response = await processVoiceIntent({
          transcript,
          context
        });
        
        console.log('🌐 BACKEND RESPONSE:', response);

        // Execute the action from backend response
        await executeVoiceAction(response);
      }

    } catch (error) {
      console.error('❌ Error processing user input:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to process your request' });
      
      // Speak error message
      dispatch({ type: 'SET_SPEAKING', payload: true });
      await speak("I'm sorry, I didn't understand that. Can you try again?");
      dispatch({ type: 'SET_SPEAKING', payload: false });
    }
  }, [state.currentStep, state.isActive, session, stopOnboarding, executeVoiceAction]);

  // Complete step
  const completeStep = useCallback((step: OnboardingStep) => {
    dispatch({ type: 'ADD_COMPLETED_STEP', payload: step });
    
    // Determine next step
    let nextStep: OnboardingStep = 'complete';
    
    switch (step) {
      case 'welcome':
        nextStep = session ? 'join-course' : 'signup';
        break;
      case 'signup':
        nextStep = 'join-course';
        break;
      case 'join-course':
        nextStep = 'first-submission';
        break;
      case 'first-submission':
        nextStep = 'complete';
        break;
      default:
        nextStep = 'complete';
    }

    dispatch({ type: 'SET_STEP', payload: nextStep });

    // Speak congratulations and next instructions
    setTimeout(async () => {
      const nextInstructions = getStepInstructions(nextStep);
      dispatch({ type: 'SET_SPEAKING', payload: true });
      await speak(`Great job! ${nextInstructions}`);
      dispatch({ type: 'SET_SPEAKING', payload: false });
    }, 1000);
  }, [session]);

  // Reset
  const reset = useCallback(() => {
    stopSpeaking();
    removeAllHighlights();
    dispatch({ type: 'RESET' });
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    dispatch({ type: 'TOGGLE_MUTE' });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      removeAllHighlights();
    };
  }, []);

  const contextValue: VoiceOnboardingContextType = {
    state,
    startOnboarding,
    stopOnboarding,
    setAgentActive,
    processUserInput,
    completeStep,
    reset,
    toggleMute
  };

  return (
    <VoiceOnboardingContext.Provider value={contextValue}>
      {children}
    </VoiceOnboardingContext.Provider>
  );
};

// Hook to use the context
export const useVoiceOnboarding = (): VoiceOnboardingContextType => {
  const context = useContext(VoiceOnboardingContext);
  if (context === undefined) {
    throw new Error('useVoiceOnboarding must be used within a VoiceOnboardingProvider');
  }
  return context;
};

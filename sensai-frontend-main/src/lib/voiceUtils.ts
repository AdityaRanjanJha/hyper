/**
 * Voice Onboarding Utilities
 * 
 * Helper functions for the voice onboarding system
 */

import { VoiceIntent, OnboardingStep } from '@/types/voice';

/**
 * Text-to-Speech utility using browser's SpeechSynthesis API
 */
export const speak = (text: string, options?: {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if speech synthesis is supported
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not supported');
      resolve();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set options with defaults
    utterance.rate = options?.rate ?? 0.9;
    utterance.pitch = options?.pitch ?? 1;
    utterance.volume = options?.volume ?? 0.8;
    
    if (options?.voice) {
      utterance.voice = options.voice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      reject(new Error('Speech synthesis failed'));
    };

    window.speechSynthesis.speak(utterance);
  });
};

/**
 * Stop any ongoing speech
 */
export const stopSpeaking = (): void => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

/**
 * Get available voices (useful for choosing a preferred voice)
 */
export const getAvailableVoices = (): SpeechSynthesisVoice[] => {
  if (!window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
};

/**
 * Highlight a DOM element by adding a CSS class
 */
export const highlightElement = (selector: string): void => {
  try {
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('voice-highlighted');
      
      // Scroll element into view
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    } else {
      console.warn(`Element not found for selector: ${selector}`);
    }
  } catch (error) {
    console.error('Error highlighting element:', error);
  }
};

/**
 * Remove highlight from a DOM element
 */
export const removeHighlight = (selector: string): void => {
  try {
    const element = document.querySelector(selector);
    if (element) {
      element.classList.remove('voice-highlighted');
    }
  } catch (error) {
    console.error('Error removing highlight:', error);
  }
};

/**
 * Remove all highlights from the page
 */
export const removeAllHighlights = (): void => {
  try {
    const highlightedElements = document.querySelectorAll('.voice-highlighted');
    highlightedElements.forEach(element => {
      element.classList.remove('voice-highlighted');
    });
  } catch (error) {
    console.error('Error removing all highlights:', error);
  }
};

/**
 * Simple intent recognition using keyword matching
 */
export const recognizeIntent = (transcript: string): VoiceIntent => {
  const lowerTranscript = transcript.toLowerCase().trim();
  
  // Define keyword patterns for each intent
  const intentPatterns: Record<VoiceIntent, string[]> = {
    signup: [
      'sign up', 'create account', 'register', 'join', 'sign me up',
      'create an account', 'get started', 'new account'
    ],
    join_course: [
      'join course', 'enroll', 'take course', 'start course',
      'find course', 'browse courses', 'see courses'
    ],
    submit_assignment: [
      'submit', 'turn in', 'submit assignment', 'hand in',
      'complete task', 'finish assignment', 'submit work'
    ],
    help: [
      'help', 'what can i do', 'what can you do', 'how does this work',
      'guide me', 'assist me', 'support', 'tutorial'
    ],
    repeat: [
      'repeat', 'say again', 'what did you say', 'pardon',
      'repeat that', 'say that again', 'again'
    ],
    stop: [
      'stop', 'quit', 'exit', 'cancel', 'disable',
      'turn off', 'no thanks', 'not now'
    ],
    unknown: []
  };

  // Check each intent pattern
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (intent === 'unknown') continue;
    
    for (const pattern of patterns) {
      if (lowerTranscript.includes(pattern)) {
        return intent as VoiceIntent;
      }
    }
  }

  return 'unknown';
};

/**
 * Generate session UUID
 */
export const generateSessionUUID = (): string => {
  return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get onboarding step instructions
 */
export const getStepInstructions = (step: OnboardingStep, context?: {
  hasAccount?: boolean;
  hasCourses?: boolean;
}): string => {
  switch (step) {
    case 'welcome':
      return "Hi! I'm your SensAI learning assistant. I can help you get started with creating an account, joining courses, and making your first submission. What would you like to do?";
    
    case 'signup':
      if (context?.hasAccount) {
        return "I see you already have an account! Let's move on to finding you a course to join.";
      }
      return "I'll help you create an account. Look for the sign-up button on the page and click it. You can also say 'help me sign up' for more guidance.";
    
    case 'join-course':
      if (context?.hasCourses) {
        return "Great! You already have courses. Let's get you started with your first assignment.";
      }
      return "Now let's find you a course to join. You can create your own course or join one with an invite link. What would you prefer?";
    
    case 'first-submission':
      return "Excellent! Now I'll guide you through making your first submission. Look for a task or assignment in your course and click on it to get started.";
    
    case 'complete':
      return "Congratulations! You've completed the onboarding process. You're all set to continue your learning journey. I'm here whenever you need help!";
    
    case 'idle':
      return "I'm here to help! You can ask me to guide you through signing up, joining courses, or making submissions. Just say 'help' if you need assistance.";
    
    default:
      return "I'm here to help you navigate SensAI. What would you like to do?";
  }
};

/**
 * Format time duration for display
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)} seconds`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

/**
 * Check if speech recognition is supported
 */
export const isSpeechRecognitionSupported = (): boolean => {
  return !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || 
           (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
};

/**
 * Check if speech synthesis is supported
 */
export const isSpeechSynthesisSupported = (): boolean => {
  return !!window.speechSynthesis;
};

/**
 * Get browser compatibility info
 */
export const getVoiceFeatureSupport = () => {
  return {
    speechRecognition: isSpeechRecognitionSupported(),
    speechSynthesis: isSpeechSynthesisSupported(),
    mediaRecorder: !!window.MediaRecorder,
    getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  };
};

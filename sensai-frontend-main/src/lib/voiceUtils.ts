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
    read_page: [
      'what does this page say', 'read this page', 'read the page',
      'what does this screen say', 'read this screen', 'read the screen',
      'describe this page', 'describe this screen', 'what\'s on this page',
      'what\'s on this screen', 'read the instructions', 'read instructions',
      'what does it say', 'tell me what it says', 'read this',
      'read the content', 'what\'s the content', 'scan this page',
      'analyze this page', 'extract the text', 'what text is here',
      'explain this page', 'can you explain this page', 'explain this screen',
      'tell me about this page', 'what is this page', 'what is on this page',
      'describe what you see', 'what can you see', 'summary of this page',
      'page summary', 'content summary', 'overview of this page',
      'walk me through this page', 'guide me through this page',
      'can you explain this page to me', 'explain this page to me'
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

/**
 * OCR and Page Content Extraction Functions
 */

/**
 * Capture current page as image for OCR processing
 */
export const capturePageScreenshot = async (): Promise<string | null> => {
  try {
    // Check if we're in a browser environment with screen capture API
    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      console.warn('Screen capture API not available');
      return null;
    }

    // Request screen capture
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true
    });

    // Create video element to capture frame
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        // Create canvas to capture frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          
          // Convert to base64
          const dataURL = canvas.toDataURL('image/png');
          
          // Stop the stream
          stream.getTracks().forEach(track => track.stop());
          
          resolve(dataURL);
        } else {
          stream.getTracks().forEach(track => track.stop());
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    return null;
  }
};

/**
 * Extract text content from current page DOM
 */
export const extractPageTextContent = (): string => {
  try {
    // Get the main content area, fallback to body
    const mainContent = document.querySelector('main') || 
                       document.querySelector('[role="main"]') || 
                       document.querySelector('.main-content') ||
                       document.body;

    if (!mainContent) {
      return 'No content found on this page.';
    }

    // Clone the element to avoid modifying the original
    const cloned = mainContent.cloneNode(true) as Element;
    
    // Remove script and style elements
    const scriptsAndStyles = cloned.querySelectorAll('script, style, noscript');
    scriptsAndStyles.forEach(el => el.remove());
    
    // Remove hidden elements
    const hiddenElements = cloned.querySelectorAll('[style*="display: none"], [hidden], .hidden');
    hiddenElements.forEach(el => el.remove());
    
    // Get text content and clean it up
    let textContent = cloned.textContent || '';
    
    // Clean up whitespace and normalize
    textContent = textContent
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();
    
    // Limit length to avoid overwhelming the assistant
    if (textContent.length > 2000) {
      textContent = textContent.substring(0, 2000) + '...';
    }
    
    return textContent || 'No readable text found on this page.';
  } catch (error) {
    console.error('Error extracting page content:', error);
    return 'Error reading page content.';
  }
};

/**
 * Extract structured page information
 */
export const extractPageStructure = (): {
  title: string;
  headings: string[];
  forms: Array<{ action?: string; method?: string; fields: string[] }>;
  links: string[];
  buttons: string[];
  images: Array<{ src?: string; alt?: string }>;
} => {
  try {
    const structure = {
      title: document.title || 'Untitled Page',
      headings: [] as string[],
      forms: [] as Array<{ action?: string; method?: string; fields: string[] }>,
      links: [] as string[],
      buttons: [] as string[],
      images: [] as Array<{ src?: string; alt?: string }>
    };

    // Extract headings
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      const text = heading.textContent?.trim();
      if (text) structure.headings.push(text);
    });

    // Extract forms
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const formInfo: { action?: string; method?: string; fields: string[] } = {
        action: form.action || undefined,
        method: form.method || undefined,
        fields: []
      };
      
      const inputs = form.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        const label = input.getAttribute('placeholder') || 
                     input.getAttribute('aria-label') || 
                     input.getAttribute('name') || 
                     input.getAttribute('id') || 
                     'Unlabeled field';
        formInfo.fields.push(label);
      });
      
      structure.forms.push(formInfo);
    });

    // Extract visible links
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
      const text = link.textContent?.trim();
      if (text && text.length < 100) { // Avoid very long link texts
        structure.links.push(text);
      }
    });

    // Extract buttons
    const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
    buttons.forEach(button => {
      const text = button.textContent?.trim() || 
                  button.getAttribute('value') || 
                  button.getAttribute('aria-label') || 
                  'Button';
      if (text) structure.buttons.push(text);
    });

    // Extract images with alt text
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (img.alt || img.src) {
        structure.images.push({
          src: img.src || undefined,
          alt: img.alt || undefined
        });
      }
    });

    return structure;
  } catch (error) {
    console.error('Error extracting page structure:', error);
    return {
      title: 'Error',
      headings: [],
      forms: [],
      links: [],
      buttons: [],
      images: []
    };
  }
};

/**
 * Create a comprehensive page summary for voice assistant
 */
export const createPageSummary = (): string => {
  try {
    const structure = extractPageStructure();
    const textContent = extractPageTextContent();
    
    let summary = `Page Title: ${structure.title}\n\n`;
    
    if (structure.headings.length > 0) {
      summary += `Main Headings:\n${structure.headings.slice(0, 5).map(h => `- ${h}`).join('\n')}\n\n`;
    }
    
    if (structure.forms.length > 0) {
      summary += `Forms on this page:\n`;
      structure.forms.forEach((form, index) => {
        summary += `Form ${index + 1}: ${form.fields.slice(0, 3).join(', ')}${form.fields.length > 3 ? '...' : ''}\n`;
      });
      summary += '\n';
    }
    
    if (structure.buttons.length > 0) {
      summary += `Available buttons: ${structure.buttons.slice(0, 5).join(', ')}${structure.buttons.length > 5 ? '...' : ''}\n\n`;
    }
    
    if (structure.links.length > 0) {
      summary += `Available links: ${structure.links.slice(0, 3).join(', ')}${structure.links.length > 3 ? '...' : ''}\n\n`;
    }
    
    summary += `Content Summary:\n${textContent.substring(0, 500)}${textContent.length > 500 ? '...' : ''}`;
    
    return summary;
  } catch (error) {
    console.error('Error creating page summary:', error);
    return 'Unable to analyze page content.';
  }
};

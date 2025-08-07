'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  MessageCircle, 
  User, 
  Bot, 
  X, 
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  processVoiceIntent, 
  processVoiceCommand,
  VoiceMemory,
  VoiceIntentResponse,
  analyzePageContext
} from '@/lib/voiceApi';
import { createPageSummary } from '@/lib/voiceUtils';

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: new() => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  intent?: string;
}

export default function VoiceAgent() {
  const { data: session } = useSession();
  const router = useRouter();
  
  // Voice Agent State
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memory, setMemory] = useState<VoiceMemory>({
    currentStep: 'welcome',
    onboardingProgress: [],
    lastResponse: 'Hi! I can help you create an account, join a course, or submit your first task.'
  });
  
  // Speech Recognition
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // Speech Synthesis
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Handle voice input processing
  const handleVoiceInput = useCallback(async (transcript: string) => {
    console.log('🎤 PROCESSING VOICE INPUT:', transcript);
    
    try {
      const userId = session?.user?.id || 'anonymous';
      
      // Analyze current page context
      const currentRoute = window.location.pathname;
      const pageContext = analyzeCurrentPageContext();
      
      // Check for control commands first
      const lowerTranscript = transcript.toLowerCase();
      console.log('🔍 Lowercase transcript:', lowerTranscript);
      
      if (['stop', 'quit', 'cancel'].some(cmd => lowerTranscript.includes(cmd))) {
        console.log('🛑 Detected stop command');
        const response = await processVoiceCommand({
          userId,
          command: 'stop',
          memory
        });
        
        const agentMessage: ChatMessage = {
          id: `agent-${Date.now()}`,
          type: 'agent',
          content: response.responseText,
          timestamp: new Date(),
          intent: 'stop'
        };
        setMessages(prev => [...prev, agentMessage]);
        setMemory(response.memory);
        
        if (!isMuted) {
          speak(response.responseText);
        }
        
        setIsOpen(false);
        return;
      }

      // Check for page reading requests
      const readPageKeywords = [
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
      ];

      console.log('🔍 Checking for page reading request:', lowerTranscript);
      console.log('🔍 Keywords to match:', readPageKeywords);
      
      const isPageReadingRequest = readPageKeywords.some(keyword => {
        const matches = lowerTranscript.includes(keyword);
        if (matches) {
          console.log('✅ Matched keyword:', keyword);
        }
        return matches;
      });

      if (isPageReadingRequest) {
        console.log('📖 Processing page reading request - EARLY RETURN!');
        // Generate page summary using OCR/content extraction
        const pageSummary = createPageSummary();
        
        const responseText = `Here's what I can see on this page: ${pageSummary}`;
        
        const agentMessage: ChatMessage = {
          id: `agent-${Date.now()}`,
          type: 'agent',
          content: responseText,
          timestamp: new Date(),
          intent: 'read_page'
        };
        setMessages(prev => [...prev, agentMessage]);
        
        // Update memory with page context
        setMemory(prev => ({
          ...prev,
          lastPageRead: window.location.pathname,
          lastPageContent: pageSummary,
          lastInteraction: new Date().toISOString()
        }));
        
        if (!isMuted) {
          speak(responseText);
        }
        
        return;
      }
      
      // Process regular voice intent with full context
      const response = await processVoiceIntent({
        userId,
        utterance: transcript,
        memory,
        currentRoute,
        pageContext
      });
      
      // Add agent response to chat
      const agentMessage: ChatMessage = {
        id: `agent-${Date.now()}`,
        type: 'agent',
        content: response.responseText,
        timestamp: new Date(),
        intent: response.intent
      };
      setMessages(prev => [...prev, agentMessage]);
      
      // Update memory
      setMemory(response.memory);
      
      // Execute action if provided
      if (response.action) {
        await executeVoiceAction(response);
      }
      
      // Speak response
      if (!isMuted) {
        speak(response.responseText);
      }
      
    } catch (error) {
      console.error('Error processing voice input:', error);
      const errorMessage: ChatMessage = {
        id: `agent-${Date.now()}`,
        type: 'agent',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
        intent: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
      
      if (!isMuted) {
        speak("I'm sorry, I encountered an error. Please try again.");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, memory, isMuted]); // executeVoiceAction and speak create circular dependencies

  // Analyze current page context for intelligent assistance
  const analyzeCurrentPageContext = useCallback(() => {
    const context: {
      hasCourses?: boolean;
      hasTeaching?: boolean;
      hasLearning?: boolean;
      formFilled?: number;
      availableElements: string[];
    } = {
      availableElements: []
    };
    
    // Detect course-related elements using text content search
    const courseCards = document.querySelectorAll('[class*="course"], [data-testid*="course"]');
    const createCourseBtn = Array.from(document.querySelectorAll('button')).find(btn => 
      btn.textContent?.toLowerCase().includes('create course') || 
      btn.textContent?.toLowerCase().includes('create')
    );
    const teachingTab = Array.from(document.querySelectorAll('button')).find(btn => 
      btn.textContent?.toLowerCase().includes('created by you') || 
      btn.textContent?.toLowerCase().includes('teaching')
    );
    const learningTab = Array.from(document.querySelectorAll('button')).find(btn => 
      btn.textContent?.toLowerCase().includes('enrolled courses') || 
      btn.textContent?.toLowerCase().includes('learning')
    );
    
    context.hasCourses = courseCards.length > 0;
    context.hasTeaching = teachingTab !== null;
    context.hasLearning = learningTab !== null;
    
    if (createCourseBtn) context.availableElements.push('create_course_btn');
    if (courseCards.length > 0) context.availableElements.push('course_cards');
    if (teachingTab) context.availableElements.push('teaching_tab');
    if (learningTab) context.availableElements.push('learning_tab');
    
    // Detect form elements for signup/login pages
    const emailField = document.querySelector('input[type="email"]');
    const passwordField = document.querySelector('input[type="password"]');
    const submitButton = document.querySelector('button[type="submit"]');
    
    if (emailField) context.availableElements.push('email_field');
    if (passwordField) context.availableElements.push('password_field');
    if (submitButton) context.availableElements.push('submit_button');
    
    // Calculate form completion percentage
    if (emailField && passwordField) {
      const filledFields = [];
      if ((emailField as HTMLInputElement).value) filledFields.push('email');
      if ((passwordField as HTMLInputElement).value) filledFields.push('password');
      context.formFilled = (filledFields.length / 2) * 100;
    }
    
    return context;
  }, []);

  // Execute actions from voice responses
  const executeVoiceAction = useCallback(async (response: VoiceIntentResponse) => {
    if (!response.action) return;
    
    const { action } = response;
    
    switch (action.type) {
      case 'navigate':
        if (action.target) {
          console.log('🧭 Navigating to:', action.target);
          router.push(action.target);
        }
        break;
      
      case 'highlight':
        if (action.target) {
          console.log('🎯 Highlighting element:', action.target);
          highlightElement(action.target);
        }
        break;
      
      case 'click':
        if (action.target) {
          console.log('👆 Clicking element:', action.target);
          const element = document.querySelector(action.target) as HTMLElement;
          if (element) {
            element.click();
          }
        }
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // router and highlightElement create circular dependencies

  // Enhanced DOM element highlighting with intelligent targeting
  const highlightElement = useCallback((selector: string) => {
    try {
      // Remove existing highlights
      document.querySelectorAll('.voice-highlight, .voice-pulse').forEach(el => {
        el.classList.remove('voice-highlight', 'voice-pulse');
      });
      
      let element: Element | null = null;
      
      // Smart selector mapping for better element targeting
      if (selector === 'create_course_btn') {
        element = Array.from(document.querySelectorAll('button')).find(btn => 
          btn.textContent?.toLowerCase().includes('create course') || 
          btn.textContent?.toLowerCase().includes('create')
        ) || document.querySelector('[data-testid*="create-course"]') || null;
      } else if (selector === 'course_cards') {
        const cards = document.querySelectorAll('[class*="course"]:not(button), [data-testid*="course"]');
        if (cards.length > 0) {
          cards.forEach(card => {
            card.classList.add('voice-highlight', 'voice-pulse');
          });
          cards[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Remove highlights after 4 seconds
          setTimeout(() => {
            cards.forEach(card => card.classList.remove('voice-highlight', 'voice-pulse'));
          }, 4000);
          return;
        }
      } else if (selector === 'email_field') {
        element = document.querySelector('input[type="email"]');
      } else if (selector === 'password_field') {
        element = document.querySelector('input[type="password"]');
      } else if (selector === 'teaching_tab') {
        element = Array.from(document.querySelectorAll('button')).find(btn => 
          btn.textContent?.toLowerCase().includes('created by you') || 
          btn.textContent?.toLowerCase().includes('teaching')
        ) || null;
      } else if (selector === 'learning_tab') {
        element = Array.from(document.querySelectorAll('button')).find(btn => 
          btn.textContent?.toLowerCase().includes('enrolled courses') || 
          btn.textContent?.toLowerCase().includes('learning')
        ) || null;
      } else {
        // Fallback to direct selector
        element = document.querySelector(selector);
      }
      
      if (element) {
        element.classList.add('voice-highlight', 'voice-pulse');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Focus on input elements for immediate interaction
        if (element.tagName === 'INPUT') {
          setTimeout(() => {
            (element as HTMLInputElement).focus();
          }, 500);
        }
        
        // Remove highlight after 4 seconds
        setTimeout(() => {
          element?.classList.remove('voice-highlight', 'voice-pulse');
        }, 4000);
        
        console.log('🎯 Highlighted element:', selector, element);
      } else {
        console.warn('Could not find element for selector:', selector);
      }
    } catch (error) {
      console.warn('Failed to highlight element:', selector, error);
    }
  }, []);

  // Text-to-speech
  const speak = useCallback((text: string) => {
    if (isMuted || !window.speechSynthesis) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    setIsSpeaking(true);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
    utterance.onend = () => {
      setIsSpeaking(false);
    };
    
    utterance.onerror = () => {
      setIsSpeaking(false);
    };
    
    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  // Initialize speech recognition only once
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window && !recognition) {
      const speechRecognition = new window.webkitSpeechRecognition();
      speechRecognition.continuous = false;
      speechRecognition.interimResults = false;
      speechRecognition.lang = 'en-US';

      speechRecognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setIsListening(true);
      };

      speechRecognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setIsListening(false);
      };

      speechRecognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript;
        const confidence = event.results[0]?.[0]?.confidence;
        
        console.log('🎤 VOICE INPUT:', { transcript, confidence });
        
        if (transcript) {
          // Add user message
          const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            type: 'user',
            content: transcript,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, userMessage]);
          
          // Process the input
          handleVoiceInput(transcript);
        }
      };

      speechRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      setRecognition(speechRecognition);
      recognitionRef.current = speechRecognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, [recognition, handleVoiceInput]);

  // Start listening
  const startListening = useCallback(() => {
    if (recognition && !isListening) {
      try {
        recognition.start();
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    }
  }, [recognition, isListening]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognition && isListening) {
      recognition.stop();
    }
  }, [recognition, isListening]);

  // Toggle voice agent
  const toggleVoiceAgent = useCallback(() => {
    if (!isOpen) {
      setIsOpen(true);
      // Add welcome message if no messages
      if (messages.length === 0) {
        const welcomeMessage: ChatMessage = {
          id: `agent-${Date.now()}`,
          type: 'agent',
          content: memory.lastResponse,
          timestamp: new Date(),
          intent: 'welcome'
        };
        setMessages([welcomeMessage]);
        
        if (!isMuted) {
          speak(memory.lastResponse);
        }
      }
    } else {
      setIsOpen(false);
      stopListening();
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isOpen, messages.length, memory.lastResponse, isMuted, stopListening, speak]);

  return (
    <>
      {/* Enhanced global styles for intelligent voice highlighting */}
      <style jsx global>{`
        .voice-highlight {
          outline: 3px solid #3b82f6 !important;
          outline-offset: 3px !important;
          background-color: rgba(59, 130, 246, 0.1) !important;
          border-radius: 8px !important;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.6) !important;
          position: relative !important;
          z-index: 1000 !important;
        }
        
        .voice-pulse {
          animation: voice-pulse 2s ease-in-out infinite !important;
        }
        
        @keyframes voice-pulse {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.4) !important;
            transform: scale(1) !important;
          }
          50% { 
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.8), 0 0 60px rgba(59, 130, 246, 0.6) !important;
            transform: scale(1.02) !important;
          }
        }
        
        .voice-highlight::before {
          content: '🎯 Voice Assistant' !important;
          position: absolute !important;
          top: -35px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          background: #3b82f6 !important;
          color: white !important;
          padding: 4px 12px !important;
          border-radius: 20px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          white-space: nowrap !important;
          z-index: 1001 !important;
          animation: voice-badge-slide 0.3s ease-out !important;
        }
        
        @keyframes voice-badge-slide {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        
        /* Special highlighting for form inputs */
        input.voice-highlight {
          outline: 3px solid #10b981 !important;
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.6) !important;
        }
        
        input.voice-highlight::before {
          content: '✏️ Enter here' !important;
          background: #10b981 !important;
        }
        
        /* Special highlighting for buttons */
        button.voice-highlight {
          outline: 3px solid #f59e0b !important;
          box-shadow: 0 0 20px rgba(245, 158, 11, 0.6) !important;
        }
        
        button.voice-highlight::before {
          content: '👆 Click here' !important;
          background: #f59e0b !important;
        }
      `}</style>

      {/* Floating Voice Agent Button */}
      <button
        onClick={toggleVoiceAgent}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-50 ${
          isOpen
            ? 'bg-red-600 hover:bg-red-700'
            : isListening
            ? 'bg-green-600 hover:bg-green-700 animate-pulse'
            : isSpeaking
            ? 'bg-blue-600 hover:bg-blue-700 animate-bounce'
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white`}
        title={isOpen ? 'Close Voice Assistant' : 'Open Voice Assistant'}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : isListening ? (
          <Mic className="w-6 h-6 animate-pulse" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>

      {/* Voice Agent Popup */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Voice Assistant
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Step: {memory.currentStep}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-1 rounded ${
                  isMuted
                    ? 'text-gray-400 hover:text-gray-600'
                    : 'text-blue-600 hover:text-blue-700'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isListening 
                  ? 'bg-green-500 animate-pulse' 
                  : isSpeaking
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-gray-400'
              }`} />
              <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                {isListening 
                  ? 'Listening...' 
                  : isSpeaking
                  ? 'Speaking...'
                  : 'Ready to help'
                }
              </span>
            </div>
          </div>

          {/* Chat Messages */}
          <div className={`${isExpanded ? 'h-80' : 'h-48'} overflow-y-auto p-4 space-y-3`}>
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Click the mic button to start talking</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-2 ${
                    message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-3 h-3" />
                    ) : (
                      <Bot className="w-3 h-3" />
                    )}
                  </div>
                  
                  <div className={`max-w-[80%] p-2 rounded-lg text-sm ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}>
                    <p>{message.content}</p>
                    {message.intent && (
                      <p className="text-xs opacity-75 mt-1">
                        Intent: {message.intent}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Controls */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isSpeaking}
                className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                  isListening
                    ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                    : isSpeaking
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title={isListening ? 'Stop Listening' : 'Start Listening'}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
              
              <div className="text-center">
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Say: &quot;create account&quot;, &quot;join course&quot;, &quot;submit task&quot;, or &quot;read this page&quot;
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

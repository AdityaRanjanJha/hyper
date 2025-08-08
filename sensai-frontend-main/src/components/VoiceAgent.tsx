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
  processVoiceIntentWithOpenAI, 
  processVoiceIntent,
  processVoiceCommand,
  VoiceMemory,
  VoiceIntentResponse,
  analyzePageContext
} from '@/lib/voiceApi';
import { createPageSummary, findAndHighlightElement } from '@/lib/voiceUtils';
import { ocrService, type StructuredPageData } from '@/lib/ocrService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
  maxAlternatives?: number;
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
  readonly isFinal: boolean;
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
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [currentPageData, setCurrentPageData] = useState<StructuredPageData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastRecognitionConfidence, setLastRecognitionConfidence] = useState<number>(0);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [contextualSuggestions, setContextualSuggestions] = useState<string[]>([]);
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

  // Log conversation to backend
  const logConversation = useCallback(async (userMessage: string, agentResponse: string, intent: string) => {
    try {
      const userId = session?.user?.id || 'anonymous';
      console.log('📝 Logging conversation:', { userMessage, agentResponse, intent, userId });
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/voice/log-interaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_uuid: userId, // Using user_id as session for consistency
          user_message: userMessage,
          ai_response: agentResponse,
          intent: intent,
          action_taken: JSON.stringify({})
        }),
      });
      
      if (response.ok) {
        console.log('✅ Conversation logged successfully');
      } else {
        console.error('❌ Failed to log conversation. Status:', response.status);
      }
    } catch (error) {
      console.error('❌ Failed to log conversation:', error);
    }
  }, [session?.user?.id]);

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

  // Enhanced keyword matching with stricter criteria
  const createStrictKeywordMatcher = useCallback((keywords: string[], requireExactMatch = false) => {
    return (transcript: string) => {
      const normalizedTranscript = transcript.toLowerCase().trim();
      
      if (requireExactMatch) {
        // Exact phrase matching
        return keywords.some(keyword => {
          const normalizedKeyword = keyword.toLowerCase();
          // Check for exact phrase or phrase at word boundaries
          const exactMatch = normalizedTranscript === normalizedKeyword;
          const phraseMatch = new RegExp(`\\b${normalizedKeyword.replace(/\s+/g, '\\s+')}\\b`).test(normalizedTranscript);
          return exactMatch || phraseMatch;
        });
      } else {
        // Flexible matching with word boundaries
        return keywords.some(keyword => {
          const normalizedKeyword = keyword.toLowerCase();
          // Split keyword into words and check if all words are present
          const keywordWords = normalizedKeyword.split(/\s+/);
          
          if (keywordWords.length === 1) {
            // Single word - check for word boundary
            return new RegExp(`\\b${keywordWords[0]}\\b`).test(normalizedTranscript);
          } else {
            // Multiple words - check if all words are present in order with some flexibility
            return keywordWords.every(word => 
              new RegExp(`\\b${word}\\b`).test(normalizedTranscript)
            );
          }
        });
      }
    };
  }, []);

  // Generate contextual suggestions based on OCR content
  const generateContextualSuggestions = useCallback((pageData: StructuredPageData | null) => {
    const suggestions: string[] = [];
    
    if (!pageData) {
      // Default suggestions when no page data
      return ['create account', 'read this page', 'what should i click'];
    }

    const { content } = pageData;
    const pageText = content.text.toLowerCase();
    const buttons = content.buttons.map(btn => btn.toLowerCase());
    const currentRoute = window.location.pathname;

    // Authentication-related suggestions
    if (currentRoute === '/login' || pageText.includes('sign') || pageText.includes('login') || pageText.includes('register')) {
      if (buttons.some(btn => btn.includes('google') || btn.includes('sign'))) {
        suggestions.push('sign up');
      }
      if (buttons.some(btn => btn.includes('login') || btn.includes('sign in'))) {
        suggestions.push('log in');
      }
      suggestions.push('create account');
    }

    // Course-related suggestions based on current page context
    if (pageText.includes('course') || currentRoute.includes('course')) {
      if (buttons.some(btn => btn.includes('create') && btn.includes('course'))) {
        suggestions.push('create course');
      }
      if (buttons.some(btn => btn.includes('join') || btn.includes('enroll'))) {
        suggestions.push('join course');
      }
      if (pageText.includes('enrolled') || pageText.includes('my courses')) {
        suggestions.push('show my courses');
      }
      if (buttons.some(btn => btn.includes('browse') || btn.includes('explore'))) {
        suggestions.push('browse courses');
      }
    }

    // Task/Assignment related suggestions
    if (pageText.includes('task') || pageText.includes('assignment') || pageText.includes('submit')) {
      if (buttons.some(btn => btn.includes('submit') || btn.includes('upload'))) {
        suggestions.push('submit task');
      }
      if (buttons.some(btn => btn.includes('create') && (btn.includes('task') || btn.includes('assignment')))) {
        suggestions.push('create task');
      }
      if (buttons.some(btn => btn.includes('view') && btn.includes('task'))) {
        suggestions.push('view tasks');
      }
    }

    // Navigation suggestions based on buttons
    if (buttons.some(btn => btn.includes('next') || btn.includes('continue'))) {
      suggestions.push('next step');
    }
    if (buttons.some(btn => btn.includes('back') || btn.includes('previous'))) {
      suggestions.push('go back');
    }
    if (buttons.some(btn => btn.includes('finish') || btn.includes('complete'))) {
      suggestions.push('finish');
    }
    if (buttons.some(btn => btn.includes('home') || btn.includes('dashboard'))) {
      suggestions.push('go home');
    }

    // Form-related suggestions
    if (content.forms.length > 0) {
      suggestions.push('fill form');
      if (buttons.some(btn => btn.includes('save') || btn.includes('submit'))) {
        suggestions.push('save form');
      }
      if (buttons.some(btn => btn.includes('reset') || btn.includes('clear'))) {
        suggestions.push('clear form');
      }
    }

    // Dashboard/Profile suggestions
    if (pageText.includes('dashboard') || pageText.includes('profile')) {
      if (buttons.some(btn => btn.includes('edit') || btn.includes('update'))) {
        suggestions.push('edit profile');
      }
      if (buttons.some(btn => btn.includes('settings'))) {
        suggestions.push('open settings');
      }
      if (buttons.some(btn => btn.includes('view') && btn.includes('profile'))) {
        suggestions.push('view profile');
      }
    }

    // Learning content suggestions
    if (pageText.includes('lesson') || pageText.includes('chapter') || pageText.includes('module')) {
      if (buttons.some(btn => btn.includes('start') || btn.includes('begin'))) {
        suggestions.push('start lesson');
      }
      if (buttons.some(btn => btn.includes('download') || btn.includes('view'))) {
        suggestions.push('download content');
      }
      if (buttons.some(btn => btn.includes('quiz') || btn.includes('test'))) {
        suggestions.push('take quiz');
      }
    }

    // Communication and collaboration
    if (pageText.includes('message') || pageText.includes('chat') || pageText.includes('discussion')) {
      if (buttons.some(btn => btn.includes('send') || btn.includes('message'))) {
        suggestions.push('send message');
      }
      if (buttons.some(btn => btn.includes('chat') || btn.includes('discuss'))) {
        suggestions.push('open chat');
      }
    }

    // Content management suggestions
    if (buttons.some(btn => btn.includes('upload'))) {
      suggestions.push('upload file');
    }
    if (buttons.some(btn => btn.includes('delete') || btn.includes('remove'))) {
      suggestions.push('delete item');
    }
    if (buttons.some(btn => btn.includes('share'))) {
      suggestions.push('share content');
    }
    if (buttons.some(btn => btn.includes('export') || btn.includes('download'))) {
      suggestions.push('export data');
    }

    // Search and filter suggestions
    if (pageText.includes('search') || buttons.some(btn => btn.includes('search'))) {
      suggestions.push('search');
    }
    if (buttons.some(btn => btn.includes('filter') || btn.includes('sort'))) {
      suggestions.push('filter results');
    }

    // Always include these universal suggestions if not already present
    if (!suggestions.includes('read this page')) {
      suggestions.push('read this page');
    }
    if (!suggestions.includes('what should i click')) {
      suggestions.push('what should i click');
    }

    // Remove duplicates and limit to 6 suggestions, prioritizing page-specific ones
    const uniqueSuggestions = [...new Set(suggestions)];
    return uniqueSuggestions.slice(0, 6);
  }, []);

  // Get suggestion category for styling
  const getSuggestionCategory = useCallback((suggestion: string) => {
    const lower = suggestion.toLowerCase();
    if (lower.includes('account') || lower.includes('sign') || lower.includes('log')) return 'auth';
    if (lower.includes('course') || lower.includes('lesson') || lower.includes('learn')) return 'learning';
    if (lower.includes('task') || lower.includes('submit') || lower.includes('assignment')) return 'task';
    if (lower.includes('next') || lower.includes('back') || lower.includes('home') || lower.includes('finish')) return 'navigation';
    if (lower.includes('read') || lower.includes('click') || lower.includes('find')) return 'help';
    return 'action';
  }, []);

  // Get suggestion styling based on category
  const getSuggestionStyling = useCallback((category: string) => {
    const styles = {
      auth: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
      learning: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
      task: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
      navigation: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
      help: 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100',
      action: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    };
    return styles[category as keyof typeof styles] || styles.action;
  }, []);

  // Update contextual suggestions when page data changes
  useEffect(() => {
    if (currentPageData) {
      const newSuggestions = generateContextualSuggestions(currentPageData);
      setContextualSuggestions(newSuggestions);
      console.log('🎯 Generated contextual suggestions:', newSuggestions);
    } else {
      setContextualSuggestions(['create account', 'read this page', 'what should i click']);
    }
  }, [currentPageData, generateContextualSuggestions]);

  // Handle voice input processing
  const handleVoiceInput = useCallback(async (transcript: string) => {
    console.log('🎤 PROCESSING VOICE INPUT:', transcript);
    
    try {
      const userId = session?.user?.id || 'anonymous';
      
      // Extract and analyze current page context using OCR service
      let pageData = currentPageData;
      if (!pageData) {
        console.log('🔍 Extracting page data with OCR service...');
        pageData = await ocrService.extractStructuredPageData();
        setCurrentPageData(pageData);
        console.log('✅ Page data extracted:', pageData);
        
        // Update suggestions immediately with new page data
        const newSuggestions = generateContextualSuggestions(pageData);
        setContextualSuggestions(newSuggestions);
        console.log('🎯 Updated suggestions with new page data:', newSuggestions);
      }
      
      const currentRoute = window.location.pathname;
      
      // Check for control commands first with strict matching
      const lowerTranscript = transcript.toLowerCase();
      console.log('🔍 Processing transcript:', lowerTranscript);
      
      // Stricter account-related keywords with exact matching
      const accountKeywords = [
        'create account', 'sign up', 'signup', 'register', 'registration',
        'log in', 'login', 'sign in', 'signin', 'get started',
        'make account', 'new account', 'create profile'
      ];
      
      const isAccountRequest = createStrictKeywordMatcher(accountKeywords, true)(transcript);
      
      if (isAccountRequest) {
        console.log('🔑 Detected account-related request with strict matching');
        
        // If already on login page, highlight the Google button
        if (currentRoute === '/login') {
          console.log('🎯 Already on login page, highlighting Google button');
          
          // Try multiple strategies to find and highlight the Google button
          const highlightGoogleButton = () => {
            const selectors = [
              '#google-signin-button',
              '[data-testid="google-signin"]',
              'button[class*="google"]',
              'button:contains("Google")',
              'button:contains("Sign in with Google")',
              '.google-signin-button'
            ];
            
            for (const selector of selectors) {
              try {
                const element = document.querySelector(selector) as HTMLElement;
                if (element) {
                  console.log('✅ Found Google button with selector:', selector);
                  element.style.outline = '3px solid #00ff00';
                  element.style.outlineOffset = '2px';
                  element.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.6)';
                  element.style.animation = 'pulse 1.5s infinite';
                  
                  // Add pulse animation if not exists
                  if (!document.querySelector('#pulse-animation-style')) {
                    const style = document.createElement('style');
                    style.id = 'pulse-animation-style';
                    style.textContent = `
                      @keyframes pulse {
                        0% { box-shadow: 0 0 15px rgba(0, 255, 0, 0.6); }
                        50% { box-shadow: 0 0 25px rgba(0, 255, 0, 0.9); }
                        100% { box-shadow: 0 0 15px rgba(0, 255, 0, 0.6); }
                      }
                    `;
                    document.head.appendChild(style);
                  }
                  
                  return true;
                }
              } catch (e) {
                console.log('Error with selector:', selector, e);
              }
            }
            return false;
          };
          
          const highlighted = highlightGoogleButton();
          const responseText = highlighted 
            ? "I've highlighted the 'Sign in with Google' button for you. Click it to create your account quickly and securely!"
            : "I can see you want to create an account. Look for the 'Sign in with Google' button on this page and click it to get started.";
            
          const agentMessage: ChatMessage = {
            id: `agent-${Date.now()}`,
            type: 'agent',
            content: responseText,
            timestamp: new Date(),
            intent: 'highlight_google_signin'
          };
          setMessages(prev => [...prev, agentMessage]);
          
          if (!isMuted) {
            speak(responseText);
          }
          
          return;
        } else {
          // Redirect to login page
          console.log('🚀 Redirecting to login page from:', currentRoute);
          router.push('/login');
          
          const responseText = "I'm taking you to the login page where you can create an account. I'll highlight the sign-in button for you once we get there!";
          
          const agentMessage: ChatMessage = {
            id: `agent-${Date.now()}`,
            type: 'agent',
            content: responseText,
            timestamp: new Date(),
            intent: 'redirect_to_login'
          };
          setMessages(prev => [...prev, agentMessage]);
          
          if (!isMuted) {
            speak(responseText);
          }
          
          // Set a timeout to highlight the button after navigation
          setTimeout(() => {
            if (window.location.pathname === '/login') {
              console.log('🎯 Auto-highlighting Google button after redirect');
              window.postMessage({ type: 'HIGHLIGHT_GOOGLE_BUTTON' }, '*');
            }
          }, 1500);
          
          return;
        }
      }
      
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
        
        // Log conversation to backend
        logConversation(transcript, response.responseText, 'stop');
        
        if (!isMuted) {
          speak(response.responseText);
        }
        
        setIsOpen(false);
        setIsContinuousMode(false);
        return;
      }

      // Stricter page reading keywords with exact phrase matching
      const readPageKeywords = [
        'read this page', 'read the page', 'read this screen', 'read the screen',
        'describe this page', 'describe this screen', 'what does this page say',
        'what does this screen say', 'what is on this page', 'what is on this screen',
        'tell me about this page', 'explain this page', 'page summary',
        'content summary', 'scan this page', 'analyze this page'
      ];

      console.log('🔍 Checking for page reading request:', lowerTranscript);
      
      const isPageReadingRequest = createStrictKeywordMatcher(readPageKeywords, true)(transcript);

      if (isPageReadingRequest) {
        console.log('📖 Processing page reading request with structured data');
        
        // Use structured page data for better content summary
        const summary = pageData ? 
          `This is ${pageData.analysis.pageType} page titled "${pageData.title}". ${pageData.content.text.substring(0, 300)}...` :
          createPageSummary();
        
        const responseText = `Here's what I can see on this page: ${summary}`;
        
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
          lastPageContent: summary,
          lastInteraction: new Date().toISOString()
        }));

        // Log conversation to backend
        logConversation(transcript, responseText, 'read_page');
        
        if (!isMuted) {
          speak(responseText);
        }
        
        return;
      }

      // Stricter element finding keywords with exact phrase matching
      const findElementKeywords = [
        'what should i click', 'where should i click', 'what button should i click',
        'where is the button', 'find the button', 'show me the button',
        'which button should i click', 'where do i click', 'what do i click',
        'how do i create', 'how do i add', 'how do i submit', 'how do i join',
        'where to click', 'help me click', 'find button', 'show button'
      ];

      const isElementFindingRequest = createStrictKeywordMatcher(findElementKeywords, false)(transcript);

      if (isElementFindingRequest) {
        console.log('🔍 Processing element finding request - EARLY RETURN!');
        
        const result = findAndHighlightElement(transcript);
        
        let responseText = '';
        if (result.found) {
          responseText = `${result.description} I've highlighted it for you!`;
        } else {
          responseText = result.description;
        }
        
        const agentMessage: ChatMessage = {
          id: `agent-${Date.now()}`,
          type: 'agent',
          content: responseText,
          timestamp: new Date(),
          intent: 'find_element'
        };
        setMessages(prev => [...prev, agentMessage]);
        
        // Update memory with element finding context
        setMemory(prev => ({
          ...prev,
          lastElementQuery: transcript,
          lastElementFound: result.found,
          lastInteraction: new Date().toISOString()
        }));

        // Log conversation to backend
        logConversation(transcript, responseText, 'find_element');

        if (!isMuted) {
          speak(responseText);
        }
        
        return;
      }
      
      // For all other queries, use enhanced OpenAI processing with structured page data
      console.log('🤖 Processing with enhanced OpenAI integration...');
      
      try {
        // First try to get a response using the OCR service with page context
        const contextualResponse = await ocrService.processQueryWithContext(
          transcript,
          pageData,
          messages.slice(-5).map(msg => ({ role: msg.type === 'user' ? 'user' : 'assistant', content: msg.content }))
        );
        
        if (contextualResponse) {
          const agentMessage: ChatMessage = {
            id: `agent-${Date.now()}`,
            type: 'agent',
            content: contextualResponse.response,
            timestamp: new Date(),
            intent: 'ai_contextual_response'
          };
          setMessages(prev => [...prev, agentMessage]);
          
          if (!isMuted) {
            speak(contextualResponse.response);
          }
          
          // Process any actions returned by AI
          if (contextualResponse.actions && contextualResponse.actions.length > 0) {
            console.log('🎯 Processing AI actions:', contextualResponse.actions);
            contextualResponse.actions.forEach(action => {
              if (action.type === 'highlight' && action.target) {
                highlightElement(action.target);
              }
            });
          }
          
          return;
        }
      } catch (error) {
        console.log('Enhanced OpenAI processing failed, falling back to standard processing:', error);
      }
      
      // Fallback to the original voice intent processing
      const response = await processVoiceIntentWithOpenAI({
        userId,
        utterance: transcript,
        memory,
        currentRoute,
        pageContext: pageData ? {
          hasCourses: pageData.content.text.toLowerCase().includes('course'),
          hasTeaching: pageData.content.text.toLowerCase().includes('teach'),
          hasLearning: pageData.content.text.toLowerCase().includes('learn'),
          isEnrolled: pageData.content.text.toLowerCase().includes('enrolled'),
          hasTasks: pageData.content.text.toLowerCase().includes('task'),
          formFilled: pageData.content.forms.length,
          availableElements: [
            ...pageData.content.buttons,
            ...pageData.content.links,
            ...pageData.content.headings
          ]
        } : analyzeCurrentPageContext()
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
      
      // Log conversation to backend
      logConversation(transcript, response.responseText, response.intent);
      
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
      
      // Provide intelligent fallback suggestions based on failed input
      const provideFallbackSuggestions = (originalTranscript: string) => {
        const suggestions = [];
        
        // Check if it sounds like account-related but didn't match strict criteria
        if (/account|sign|login|register/i.test(originalTranscript)) {
          suggestions.push('Try saying "create account" or "sign up"');
        }
        
        // Check if it sounds like page reading but didn't match
        if (/read|page|screen|describe|what/i.test(originalTranscript)) {
          suggestions.push('Try saying "read this page" or "describe this page"');
        }
        
        // Check if it sounds like element finding but didn't match
        if (/click|button|where|find|show/i.test(originalTranscript)) {
          suggestions.push('Try saying "what should I click" or "find the button"');
        }
        
        if (suggestions.length > 0) {
          return `I didn't quite understand that. ${suggestions.join(' or ')}.`;
        }
        
        return "I didn't understand that command. Try saying things like 'create account', 'read this page', or 'what should I click'.";
      };
      
      const errorMessage: ChatMessage = {
        id: `agent-${Date.now()}`,
        type: 'agent',
        content: provideFallbackSuggestions(transcript),
        timestamp: new Date(),
        intent: 'fallback_suggestion'
      };
      setMessages(prev => [...prev, errorMessage]);
      
      if (!isMuted) {
        speak(provideFallbackSuggestions(transcript));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, memory, isMuted, currentPageData, setCurrentPageData, messages, router, setIsContinuousMode]); // executeVoiceAction and speak create circular dependencies

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

  // Enhanced Text-to-speech with better voice selection
  const speak = useCallback((text: string) => {
    if (isMuted || !window.speechSynthesis) {
      console.log('🔇 Speech synthesis disabled or not available');
      return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    setIsSpeaking(true);
    console.log('🎤 Starting speech synthesis:', text);
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Enhanced voice settings for more natural speech
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.1; // Slightly higher pitch for friendliness
    utterance.volume = 0.9; // Clear volume
    
    // Function to find and set the best voice
    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log('🎯 Available voices:', voices.length);
      
      if (voices.length === 0) {
        console.log('⏳ No voices loaded yet, will use default');
        return false;
      }
      
      // Priority order for voice selection (more natural sounding voices)
      const preferredVoices = [
        'Microsoft Aria Online (Natural) - English (United States)', // Windows 11 natural voice
        'Microsoft Zira - English (United States)', // Windows default
        'Google US English Female', // Chrome
        'Alex', // macOS
        'Samantha', // macOS
        'Karen', // macOS
        'Moira', // macOS
        'Tessa', // macOS
        'Serena', // macOS
      ];
      
      // Find the best available voice
      let selectedVoice = null;
      for (const preferredName of preferredVoices) {
        selectedVoice = voices.find(voice => 
          voice.name.includes(preferredName) || 
          voice.name.toLowerCase().includes(preferredName.toLowerCase())
        );
        if (selectedVoice) break;
      }
      
      // Fallback to female English voices if preferred voices not found
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
          voice.lang.startsWith('en') && 
          (voice.name.toLowerCase().includes('female') || 
           voice.name.toLowerCase().includes('woman') ||
           voice.name.toLowerCase().includes('aria') ||
           voice.name.toLowerCase().includes('zira') ||
           voice.name.toLowerCase().includes('karen') ||
           voice.name.toLowerCase().includes('samantha'))
        );
      }
      
      // Final fallback to any English voice
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => voice.lang.startsWith('en'));
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('🎤 Using voice:', selectedVoice.name);
        return true;
      }
      
      console.log('⚠️ No suitable voice found, using default');
      return false;
    };
    
    // Set up event handlers
    utterance.onend = () => {
      console.log('✅ Speech synthesis completed');
      setIsSpeaking(false);
    };
    
    utterance.onerror = (event) => {
      console.error('❌ Speech synthesis error:', event.error);
      setIsSpeaking(false);
    };
    
    utterance.onstart = () => {
      console.log('🎵 Speech synthesis started');
    };
    
    // Try to set voice immediately
    if (!setVoice()) {
      // If voices aren't loaded, wait for them
      const handleVoicesChanged = () => {
        console.log('🔄 Voices changed, retrying voice selection');
        setVoice();
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
      
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      
      // Fallback timeout to proceed without specific voice after 1 second
      setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      }, 1000);
    }
    
    speechSynthesisRef.current = utterance;
    
    // Start speaking with a small delay to ensure everything is set up
    setTimeout(() => {
      if (speechSynthesisRef.current === utterance) {
        try {
          window.speechSynthesis.speak(utterance);
          console.log('🚀 Speech synthesis queued');
        } catch (error) {
          console.error('❌ Failed to start speech synthesis:', error);
          setIsSpeaking(false);
        }
      }
    }, 100);
  }, [isMuted]);

  // Initialize speech recognition only once
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window && !recognition) {
      const speechRecognition = new window.webkitSpeechRecognition();
      
      // Enhanced speech recognition settings for better accuracy
      speechRecognition.continuous = false;
      speechRecognition.interimResults = true; // Enable interim results for faster feedback
      speechRecognition.lang = 'en-US';
      if (speechRecognition.maxAlternatives !== undefined) {
        speechRecognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy
      }
      
      // Additional properties for better recognition (if supported)
      try {
        const extendedRecognition = speechRecognition as SpeechRecognition & { 
          serviceURI?: string; 
          grammars?: unknown; 
        };
        extendedRecognition.serviceURI = 'chrome://settings/';
        extendedRecognition.grammars = null; // Use default grammar
      } catch {
        console.log('Advanced speech recognition features not available');
      }

      speechRecognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setIsListening(true);
      };

      speechRecognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setIsListening(false);
        
        // If continuous mode is enabled and the popup is still open, restart listening
        if (isContinuousMode && isOpen) {
          console.log('🔄 Restarting speech recognition for continuous mode...');
          // Add a small delay to prevent rapid restarts
          setTimeout(() => {
            if (isContinuousMode && isOpen && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch {
                console.log('🎤 Recognition restart attempted while still active, ignoring...');
              }
            }
          }, 1000);
        }
      };

      speechRecognition.onresult = async (event: SpeechRecognitionEvent) => {
        const result = event.results[event.results.length - 1];
        
        // Only process final results for better accuracy
        if (!result.isFinal && !event.results[0].isFinal) {
          return;
        }
        
        // Get the best transcript from multiple alternatives
        let bestTranscript = '';
        let bestConfidence = 0;
        
        for (let i = 0; i < result.length; i++) {
          const alternative = result[i];
          if (alternative.confidence > bestConfidence) {
            bestTranscript = alternative.transcript;
            bestConfidence = alternative.confidence;
          }
        }
        
        // Fallback to first alternative if confidence is not available
        if (!bestTranscript) {
          bestTranscript = result[0]?.transcript || '';
          bestConfidence = result[0]?.confidence || 0;
        }
        
        console.log('🎤 VOICE INPUT:', { 
          transcript: bestTranscript, 
          confidence: bestConfidence,
          alternatives: Array.from(result).map(alt => ({ 
            transcript: alt.transcript, 
            confidence: alt.confidence 
          }))
        });
        
        // Only process if confidence is above threshold or transcript is not empty
        if (bestTranscript && (bestConfidence > 0.7 || bestConfidence === 0)) {
          // Update confidence state
          setLastRecognitionConfidence(bestConfidence);
          setIsProcessingCommand(true);
          
          // Clean up the transcript
          const cleanedTranscript = bestTranscript
            .trim()
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/[^\w\s'-]/g, '') // Remove special characters except apostrophes and hyphens
            .toLowerCase();
          
          // Add user message
          const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            type: 'user',
            content: bestTranscript,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, userMessage]);
          
          // Process the cleaned input
          try {
            await handleVoiceInput(cleanedTranscript);
          } finally {
            setIsProcessingCommand(false);
          }
        } else {
          console.log('🎤 Low confidence transcript rejected:', { bestTranscript, bestConfidence });
          setLastRecognitionConfidence(bestConfidence);
        }
      };

      speechRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.log('🎤 Speech recognition event:', event.error);
        
        // Handle different error types appropriately
        switch (event.error) {
          case 'no-speech':
            // This is normal - user didn't speak, just try again
            console.log('🤫 No speech detected, waiting for input...');
            break;
          case 'audio-capture':
            console.warn('🎤 Audio capture failed - check microphone permissions');
            break;
          case 'not-allowed':
            console.error('🚫 Microphone access denied by user');
            break;
          case 'network':
            console.warn('🌐 Network error during speech recognition');
            break;
          case 'aborted':
            console.log('🛑 Speech recognition was aborted');
            break;
          default:
            console.warn('🎤 Speech recognition error:', event.error);
        }
        
        setIsListening(false);
        
        // Only show user-facing errors for serious issues
        if (['not-allowed', 'audio-capture'].includes(event.error)) {
          const errorMessage: ChatMessage = {
            id: `agent-${Date.now()}`,
            type: 'agent',
            content: event.error === 'not-allowed' 
              ? "I need microphone access to hear you. Please allow microphone permissions and try again."
              : "I'm having trouble accessing your microphone. Please check your microphone and try again.",
            timestamp: new Date(),
            intent: 'error'
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      };

      setRecognition(speechRecognition);
      recognitionRef.current = speechRecognition;
    }

    // Initialize speech synthesis voices
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Load voices immediately if available
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          console.log('🎤 Available voices loaded:', voices.length);
          // Log some preferred voices if found
          const preferredVoices = voices.filter(voice => 
            voice.name.includes('Aria') || 
            voice.name.includes('Zira') || 
            voice.name.includes('Karen') ||
            voice.name.includes('Samantha')
          );
          if (preferredVoices.length > 0) {
            console.log('🎤 Found preferred voices:', preferredVoices.map(v => v.name));
          }
        }
      };

      // Load voices on event (some browsers need this)
      window.speechSynthesis.onvoiceschanged = loadVoices;
      
      // Try to load immediately
      loadVoices();
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, [recognition, handleVoiceInput, isContinuousMode, isOpen]);

  // Handle continuous listening mode
  useEffect(() => {
    if (isContinuousMode && !isListening && !isSpeaking && recognition) {
      // Auto restart listening after a brief delay in continuous mode
      const timer = setTimeout(() => {
        console.log('🔄 Auto-restarting listening in continuous mode');
        try {
          recognition.start();
        } catch (error) {
          console.log('Recognition already active or failed:', error);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isContinuousMode, isListening, isSpeaking, recognition]);

  // Page navigation listener to update OCR data
  useEffect(() => {
    const handleRouteChange = () => {
      console.log('🗺️ Page changed, clearing cached OCR data');
      setCurrentPageData(null);
    };

    // Listen for browser navigation events
    window.addEventListener('popstate', handleRouteChange);
    
    // Also clear when the pathname changes (for client-side navigation)
    const currentPath = window.location.pathname;
    const checkForPathChange = setInterval(() => {
      if (window.location.pathname !== currentPath) {
        handleRouteChange();
      }
    }, 1000);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      clearInterval(checkForPathChange);
    };
  }, [setCurrentPageData]);

  // Toggle continuous mode when button is clicked
  const handleContinuousToggle = useCallback(() => {
    const newMode = !isContinuousMode;
    setIsContinuousMode(newMode);
    
    if (newMode) {
      console.log('🔄 Enabling continuous listening mode');
      // Start listening immediately when enabling continuous mode
      if (!isListening && recognition) {
        try {
          recognition.start();
        } catch (error) {
          console.log('Recognition failed to start:', error);
        }
      }
    } else {
      console.log('⏸️ Disabling continuous listening mode');
      // Stop listening when disabling continuous mode
      if (isListening && recognition) {
        recognition.stop();
      }
    }
  }, [isContinuousMode, setIsContinuousMode, isListening, recognition]);

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

      {/* Floating Voice Agent Button - Enhanced Design */}
      <Button
        onClick={toggleVoiceAgent}
        variant="ghost"
        size="icon"
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg transition-all duration-300 z-50 border-2",
          isOpen 
            ? "bg-red-500 hover:bg-red-600 text-white border-red-400 scale-110 shadow-xl"
            : isListening
            ? "bg-green-500 hover:bg-green-600 text-white border-green-400 animate-pulse scale-110 shadow-xl"
            : isSpeaking
            ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-400 animate-bounce scale-105 shadow-xl"
            : isContinuousMode
            ? "bg-orange-100 text-orange-600 hover:bg-orange-200 border-orange-300"
            : "bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
        )}
        title={
          isOpen 
            ? 'Close SensAI Assistant' 
            : isContinuousMode
            ? 'SensAI Assistant (Continuous Mode Active)'
            : 'Open SensAI Assistant'
        }
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : isListening ? (
          <div className="relative">
            <Mic className="w-6 h-6" />
            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping"></div>
          </div>
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6" />
            {!isOpen && isContinuousMode && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse border-2 border-white"></div>
            )}
            {isContinuousMode && (
              <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            )}
          </div>
        )}
      </Button>

      {/* Voice Agent Popup - Modern Light Design */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-96 shadow-xl border-gray-300 z-50 bg-gray-50">
          
          {/* Header */}
          <CardHeader className="border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
                    isListening ? 'bg-green-500 animate-pulse' : 
                    isSpeaking ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
                  )}></div>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    SensAI Assistant
                  </h3>
                  <p className="text-sm text-gray-600">
                    {isListening ? 'Listening...' : 
                     isSpeaking ? 'Speaking...' :
                     isProcessingCommand ? 'Processing...' :
                     'Ready to help'}
                  </p>
                  {lastRecognitionConfidence > 0 && (
                    <div className="mt-1 flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1">
                        <div 
                          className={cn(
                            "h-1 rounded-full transition-all duration-300",
                            lastRecognitionConfidence > 0.8 ? 'bg-green-500' :
                            lastRecognitionConfidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                          )}
                          style={{ width: `${Math.max(lastRecognitionConfidence * 100, 10)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.round(lastRecognitionConfidence * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  className={cn(
                    "w-8 h-8",
                    isMuted ? "text-gray-400 hover:text-gray-600" : "text-gray-700 hover:text-gray-900"
                  )}
                  title={isMuted ? 'Unmute Voice' : 'Mute Voice'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-8 h-8 text-gray-400 hover:text-gray-600"
                  title={isExpanded ? 'Collapse Chat' : 'Expand Chat'}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="mt-3 flex items-center justify-center">
              <div className="flex items-center space-x-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1 rounded-full transition-all duration-300",
                      isListening 
                        ? 'bg-green-500 animate-pulse h-4' 
                        : isSpeaking
                        ? 'bg-blue-500 h-3'
                        : 'bg-gray-300 h-2'
                    )}
                    style={{
                      animationDelay: `${i * 100}ms`,
                      height: isSpeaking ? `${Math.random() * 12 + 8}px` : undefined
                    }}
                  />
                ))}
              </div>
            </div>
          </CardHeader>

          {/* Chat Messages */}
          <CardContent className={cn(
            "p-0",
            isExpanded ? 'h-96' : 'h-60'
          )}>
            <div className="h-full overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-center text-gray-600 py-8">
                  <div className="w-12 h-12 mx-auto mb-4 bg-gray-200 rounded-xl flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-gray-500" />
                  </div>
                  <p className="text-base font-medium mb-2 text-gray-900">Hello! I&apos;m SensAI</p>
                  <p className="text-sm text-gray-600">Your intelligent voice assistant</p>
                  <p className="text-xs text-gray-500 mt-3">
                    Click the mic button below or try saying:<br/>
                    <span className="font-medium text-gray-800">&quot;create account&quot;</span> • <span className="font-medium text-gray-800">&quot;join course&quot;</span>
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex items-start space-x-2",
                      message.type === 'user' && "flex-row-reverse space-x-reverse"
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                      message.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    )}>
                      {message.type === 'user' ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>
                    
                    <div className={cn(
                      "flex-1 max-w-[85%]",
                      message.type === 'user' ? 'text-right' : 'text-left'
                    )}>
                      <div className={cn(
                        "inline-block p-3 rounded-lg text-sm leading-relaxed",
                        message.type === 'user'
                          ? 'bg-blue-500 text-white rounded-br-sm'
                          : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm shadow-sm'
                      )}>
                        <p className="font-medium">{message.content}</p>
                        {message.intent && (
                          <div className="mt-2 pt-2 border-t border-gray-200/50">
                            <span className="text-xs opacity-75 bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                              {message.intent}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 px-2">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>

          {/* Controls */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-4">
              {/* Continuous Mode Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleContinuousToggle}
                className={cn(
                  "w-10 h-10 rounded-lg",
                  isContinuousMode
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                )}
                title={isContinuousMode ? 'Disable Continuous Mode' : 'Enable Continuous Mode'}
              >
                {isContinuousMode ? (
                  <div className="relative">
                    <Volume2 className="w-5 h-5" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </Button>
              
              {/* Main Mic Button */}
              <Button
                onClick={isListening ? stopListening : startListening}
                disabled={isSpeaking}
                variant={isListening ? "destructive" : "default"}
                size="lg"
                className={cn(
                  "w-14 h-14 rounded-xl transition-all duration-300",
                  isListening 
                    ? "bg-red-500 hover:bg-red-600 text-white animate-pulse scale-110" 
                    : "bg-blue-500 hover:bg-blue-600 text-white",
                  isSpeaking && "opacity-50 cursor-not-allowed bg-gray-400"
                )}
                title={isListening ? 'Stop Listening' : isSpeaking ? 'Speaking...' : 'Start Listening'}
              >
                {isListening ? (
                  <MicOff className="w-6 h-6" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </Button>
              
              {/* Status Information */}
              <div className="flex-1 ml-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      Try saying:
                    </p>
                    {isContinuousMode && (
                      <div className="flex items-center space-x-1 px-2 py-1 bg-orange-100 rounded-full">
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium text-orange-600">
                          Always Listening
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {contextualSuggestions.slice(0, 2).map((suggestion, index) => {
                      const category = getSuggestionCategory(suggestion);
                      const styling = getSuggestionStyling(category);
                      return (
                        <span 
                          key={index} 
                          className={`px-2 py-1 rounded-md text-xs font-medium border ${styling.replace('hover:', '')}`}
                        >
                          &quot;{suggestion}&quot;
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contextualSuggestions.slice(2, 4).map((suggestion, index) => {
                      const category = getSuggestionCategory(suggestion);
                      const styling = getSuggestionStyling(category);
                      return (
                        <span 
                          key={index + 2} 
                          className={`px-2 py-1 rounded-md text-xs font-medium border ${styling.replace('hover:', '')}`}
                        >
                          &quot;{suggestion}&quot;
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Quick Action Buttons */}
            <div className="flex justify-center space-x-2 pt-3 border-t border-gray-200">
              {contextualSuggestions.slice(0, 3).map((suggestion, index) => {
                const category = getSuggestionCategory(suggestion);
                const styling = getSuggestionStyling(category);
                return (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleVoiceInput(suggestion)}
                    className={`text-xs flex-1 max-w-[120px] border ${styling}`}
                    title={`Say: ${suggestion}`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-medium">
                        {suggestion.length > 10 ? `${suggestion.substring(0, 8)}...` : suggestion}
                      </span>
                      <span className="text-xs opacity-75 capitalize">
                        {category}
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>
            
            {/* Secondary Action Buttons */}
            {contextualSuggestions.length > 3 && (
              <div className="flex justify-center space-x-2 pt-2">
                {contextualSuggestions.slice(3, 6).map((suggestion, index) => {
                  const category = getSuggestionCategory(suggestion);
                  const styling = getSuggestionStyling(category);
                  return (
                    <Button
                      key={index + 3}
                      variant="outline"
                      size="sm"
                      onClick={() => handleVoiceInput(suggestion)}
                      className={`text-xs flex-1 max-w-[120px] border ${styling}`}
                      title={`Say: ${suggestion}`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-medium">
                          {suggestion.length > 10 ? `${suggestion.substring(0, 8)}...` : suggestion}
                        </span>
                        <span className="text-xs opacity-75 capitalize">
                          {category}
                        </span>
                      </div>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
}

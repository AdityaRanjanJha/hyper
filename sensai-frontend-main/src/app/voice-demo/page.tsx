'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, MessageCircle, User, Bot, Play, Pause } from 'lucide-react';
import { useVoiceOnboarding } from '@/providers/VoiceOnboardingProvider';

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

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  isPlaying?: boolean;
}

export default function VoiceDemoPage() {
  const {
    state,
    startOnboarding,
    stopOnboarding,
    processUserInput,
    toggleMute
  } = useVoiceOnboarding();

  const [messages, setMessages] = useState<Message[]>([]);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
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
        
        console.log('🎤 VOICE INPUT:', {
          timestamp: new Date().toISOString(),
          transcript,
          confidence
        });
        
        if (transcript) {
          // Add user message to chat
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: 'user',
            content: transcript,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, userMessage]);
          
          // Process the input
          processUserInput(transcript);
        }
      };

      speechRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      setRecognition(speechRecognition);
    }
  }, [processUserInput]);

  const getAgentResponse = useCallback(() => {
    // Generate appropriate response based on current step
    switch (state.currentStep) {
      case 'welcome':
        return "Hello! I'm your voice assistant. I'm here to help you get started with SensAI. What would you like to do today?";
      case 'signup_prompt':
        return "I can help you create an account. Would you like to sign up for SensAI?";
      case 'course_selection':
        return "Great! Let me show you some available courses. Which subject interests you most?";
      case 'first_submission':
        return "Perfect! Now let's make your first submission. I'll guide you through the process.";
      default:
        return "I'm here to help! You can say things like 'help me get started', 'show me courses', or 'sign me up'.";
    }
  }, [state.currentStep]);

  // Listen for state changes to add agent messages
  useEffect(() => {
    if (state.transcript && state.isSpeaking) {
      // Find any recent messages that might be the agent speaking
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.type !== 'agent' || 
          Date.now() - lastMessage.timestamp.getTime() > 5000) {
        
        // Add agent message
        const agentMessage: Message = {
          id: `agent-${Date.now()}`,
          type: 'agent',
          content: getAgentResponse(),
          timestamp: new Date(),
          isPlaying: true
        };
        setMessages(prev => [...prev, agentMessage]);
        setCurrentlyPlaying(agentMessage.id);
      }
    }
    
    if (!state.isSpeaking && currentlyPlaying) {
      setCurrentlyPlaying(null);
      setMessages(prev => prev.map(msg => 
        msg.id === currentlyPlaying ? { ...msg, isPlaying: false } : msg
      ));
    }
  }, [state.isSpeaking, state.transcript, currentlyPlaying, messages, getAgentResponse]);

  const handleMicClick = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (!state.isActive) {
      startOnboarding();
      // Add welcome message
      const welcomeMessage: Message = {
        id: `agent-welcome-${Date.now()}`,
        type: 'agent',
        content: "Hello! I'm your SensAI voice assistant. I'm ready to help you get started!",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, welcomeMessage]);
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const playMessage = (message: Message) => {
    if ('speechSynthesis' in window) {
      // Stop any current speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(message.content);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = state.isMuted ? 0 : 1;
      
      utterance.onstart = () => {
        setCurrentlyPlaying(message.id);
        setMessages(prev => prev.map(msg => 
          msg.id === message.id ? { ...msg, isPlaying: true } : msg
        ));
      };
      
      utterance.onend = () => {
        setCurrentlyPlaying(null);
        setMessages(prev => prev.map(msg => 
          msg.id === message.id ? { ...msg, isPlaying: false } : msg
        ));
      };
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const clearChat = () => {
    setMessages([]);
    stopOnboarding();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  SensAI Voice Assistant Demo
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Experience voice-guided onboarding
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  state.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`} />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {state.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <button
                onClick={clearChat}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 h-[600px] flex flex-col">
              
              {/* Chat Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Voice Conversation
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Click the microphone and start speaking
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
                    <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Start a conversation by clicking the microphone button</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex items-start space-x-3 ${
                        message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.type === 'user' 
                          ? 'bg-blue-500' 
                          : 'bg-purple-500'
                      }`}>
                        {message.type === 'user' ? (
                          <User className="w-4 h-4 text-white" />
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>
                      
                      <div className={`flex-1 max-w-xs lg:max-w-md ${
                        message.type === 'user' ? 'text-right' : ''
                      }`}>
                        <div className={`p-3 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}>
                          <p className="text-sm">{message.content}</p>
                          {message.isPlaying && (
                            <div className="flex items-center mt-2 text-xs opacity-75">
                              <Volume2 className="w-3 h-3 mr-1" />
                              <span>Speaking...</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                          
                          {message.type === 'agent' && (
                            <button
                              onClick={() => playMessage(message)}
                              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center"
                              disabled={message.isPlaying}
                            >
                              {message.isPlaying ? (
                                <Pause className="w-3 h-3" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input Controls */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  
                  {/* Microphone Control */}
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={handleMicClick}
                      disabled={state.isSpeaking}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isListening
                          ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                          : state.isSpeaking
                          ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    
                    <button
                      onClick={toggleMute}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                        state.isMuted
                          ? 'bg-gray-300 dark:bg-gray-600 text-gray-500'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {state.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Status */}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {state.isSpeaking ? (
                      <span className="flex items-center">
                        <Volume2 className="w-4 h-4 mr-1 animate-pulse" />
                        Assistant is speaking...
                      </span>
                    ) : isListening ? (
                      <span className="flex items-center">
                        <Mic className="w-4 h-4 mr-1 animate-pulse" />
                        Listening...
                      </span>
                    ) : (
                      <span>Ready to listen</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Panel */}
          <div className="space-y-6">
            
            {/* Current State */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Current State
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={`text-sm font-medium ${
                    state.isActive ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {state.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Step:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {state.currentStep.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Listening:</span>
                  <span className={`text-sm font-medium ${
                    isListening ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {isListening ? 'Yes' : 'No'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Speaking:</span>
                  <span className={`text-sm font-medium ${
                    state.isSpeaking ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {state.isSpeaking ? 'Yes' : 'No'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Muted:</span>
                  <span className={`text-sm font-medium ${
                    state.isMuted ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {state.isMuted ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              
              {state.transcript && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Last heard:</p>
                  <p className="text-sm text-gray-900 dark:text-white">&ldquo;{state.transcript}&rdquo;</p>
                </div>
              )}
              
              {state.error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-xs text-red-600 dark:text-red-400 mb-1">Error:</p>
                  <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Try These Commands
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <code className="text-blue-600 dark:text-blue-400">&ldquo;Help me get started&rdquo;</code>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <code className="text-blue-600 dark:text-blue-400">&ldquo;Show me courses&rdquo;</code>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <code className="text-blue-600 dark:text-blue-400">&ldquo;I want to sign up&rdquo;</code>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <code className="text-blue-600 dark:text-blue-400">&ldquo;What does this page say?&rdquo;</code>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <code className="text-blue-600 dark:text-blue-400">&ldquo;Read this page&rdquo;</code>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <code className="text-blue-600 dark:text-blue-400">&ldquo;What should I click to add a module?&rdquo;</code>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <code className="text-blue-600 dark:text-blue-400">&ldquo;How do I create a course?&rdquo;</code>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <code className="text-blue-600 dark:text-blue-400">&ldquo;Where is the submit button?&rdquo;</code>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <code className="text-blue-600 dark:text-blue-400">&ldquo;Help&rdquo;</code>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <code className="text-blue-600 dark:text-blue-400">&ldquo;Repeat&rdquo;</code>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <code className="text-blue-600 dark:text-blue-400">&ldquo;Stop&rdquo;</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

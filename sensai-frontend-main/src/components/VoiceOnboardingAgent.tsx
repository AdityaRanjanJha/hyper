'use client';

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X, HelpCircle } from 'lucide-react';
import { useVoiceOnboarding } from '../providers/VoiceOnboardingProvider';
import { OnboardingStep } from '../types/voice';

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

export default function VoiceOnboardingAgent() {
  const {
    state,
    startOnboarding,
    stopOnboarding,
    processUserInput,
    toggleMute
  } = useVoiceOnboarding();

  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

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
          confidence,
          results: event.results
        });
        
        if (transcript) {
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

  // Auto-hide tooltip after 3 seconds
  useEffect(() => {
    if (showTooltip) {
      const timer = setTimeout(() => setShowTooltip(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showTooltip]);

  const handleMicClick = () => {
    console.log('🎤 Mic button clicked:', { 
      recognitionAvailable: !!recognition,
      isActive: state.isActive,
      isListening 
    });
    
    if (!recognition) {
      alert('Speech recognition is not supported in your browser');
      return;
    }

    if (!state.isActive) {
      console.log('🎤 Starting onboarding...');
      startOnboarding();
    }

    if (isListening) {
      console.log('🎤 Stopping recognition...');
      recognition.stop();
    } else {
      console.log('🎤 Starting recognition...');
      recognition.start();
    }
  };

  const handleHelpClick = () => {
    setShowTooltip(!showTooltip);
  };

  const getStepDescription = (step: OnboardingStep): string => {
    switch (step) {
      case 'welcome':
        return 'Getting started with voice guidance';
      case 'signup_prompt':
        return 'Ready to create your account';
      case 'signup_form':
        return 'Filling out registration form';
      case 'course_selection':
        return 'Choosing your first course';
      case 'first_submission':
        return 'Making your first submission';
      case 'completed':
        return 'Onboarding complete!';
      default:
        return 'Voice guidance active';
    }
  };

  const getHelpText = (): string => {
    return `
      Voice Commands:
      • "Help" - Get instructions for current step
      • "Repeat" - Repeat last instruction
      • "Sign up" - Start account creation
      • "Join course" - Browse available courses
      • "Submit assignment" - Submit your work
      • "Stop" - End voice guidance
    `;
  };

  if (!state.isActive) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => startOnboarding()}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 flex items-center gap-2"
          title="Start Voice Guidance"
        >
          <Volume2 size={20} />
          <span className="hidden sm:inline">Voice Guide</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Status Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 min-w-64 max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${state.isListening || isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Voice Guide
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleHelpClick}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Help"
            >
              <HelpCircle size={16} />
            </button>
            <button
              onClick={stopOnboarding}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Stop Voice Guidance"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Step Information */}
        <div className="mb-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {getStepDescription(state.currentStep)}
          </div>
          {state.transcript && (
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              &ldquo;{state.transcript}&rdquo;
            </div>
          )}
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
            {state.error}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleMicClick}
              disabled={state.isSpeaking}
              className={`p-2 rounded-full transition-all duration-200 ${
                isListening
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                  : state.isSpeaking
                  ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30'
              }`}
              title={isListening ? 'Stop Listening' : 'Start Listening'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            <button
              onClick={toggleMute}
              className={`p-2 rounded-full transition-all duration-200 ${
                state.isMuted
                  ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30'
              }`}
              title={state.isMuted ? 'Unmute' : 'Mute'}
            >
              {state.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            {state.isSpeaking ? 'Speaking...' : 
             isListening ? 'Listening...' : 
             'Ready'}
          </div>
        </div>
      </div>

      {/* Help Tooltip */}
      {showTooltip && (
        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 max-w-xs whitespace-pre-line shadow-xl">
          {getHelpText()}
        </div>
      )}
    </div>
  );
}

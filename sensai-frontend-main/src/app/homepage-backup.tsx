'use client';

import React, { useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, MessageCircle, BookOpen, Users, Award, ArrowRight, X } from 'lucide-react';
import { useVoiceOnboarding } from '@/providers/VoiceOnboardingProvider';
import Link from 'next/link';

export default function HomePage() {
  const {
    state,
    startOnboarding,
    stopOnboarding,
    toggleMute
  } = useVoiceOnboarding();

  const [showVoiceGuide, setShowVoiceGuide] = useState(false);

  const handleStartVoiceGuide = () => {
    setShowVoiceGuide(true);
    startOnboarding();
  };

  const handleStopVoiceGuide = () => {
    setShowVoiceGuide(false);
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
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  SensAI
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  The only LMS you need in the era of AI
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link 
                href="/voice-demo"
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Voice Demo
              </Link>
              <Link 
                href="/login"
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Sign In
              </Link>
              <Link 
                href="/signup"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Learn Smarter with
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> AI</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Experience the future of education with our AI-powered learning management system. 
            Personalized courses, intelligent assessments, and voice-guided onboarding.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              href="/signup"
              className="flex items-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Learning
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            
            <button
              onClick={handleStartVoiceGuide}
              className="flex items-center px-8 py-3 border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <Mic className="w-5 h-5 mr-2" />
              Try Voice Guide
            </button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Why Choose SensAI?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Discover the features that make learning effortless and engaging
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              AI-Powered Courses
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Adaptive learning paths that adjust to your pace and learning style for maximum efficiency.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Voice Assistant
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Navigate and learn hands-free with our intelligent voice-guided onboarding system.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <Award className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Smart Assessments
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Intelligent testing that provides instant feedback and identifies areas for improvement.
            </p>
          </div>
        </div>
      </div>

      {/* Voice Guide Side Panel */}
      {showVoiceGuide && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleStopVoiceGuide} />
          <div className="absolute right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out">
            
            {/* Panel Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Voice Guide
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Let me help you get started
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleStopVoiceGuide}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Voice Status */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    state.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {state.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <button
                  onClick={toggleMute}
                  className={`p-2 rounded-lg transition-colors ${
                    state.isMuted
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                  }`}
                >
                  {state.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>

              <div className={`p-4 rounded-lg text-center transition-colors ${
                state.isSpeaking 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-700'
              }`}>
                {state.isSpeaking ? (
                  <div className="flex items-center justify-center space-x-2 text-blue-600">
                    <Volume2 className="w-5 h-5 animate-pulse" />
                    <span className="font-medium">Assistant is speaking...</span>
                  </div>
                ) : (
                  <div className="text-gray-600 dark:text-gray-300">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Ready to help you get started!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Try saying:
              </h3>
              
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    "Help me get started"
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    "Show me courses"
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    "I want to sign up"
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    "Help" or "Repeat"
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Tip:</strong> Make sure your microphone is enabled and speak clearly for best results.
                </p>
              </div>
            </div>

            {/* Full Demo Link */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <Link 
                href="/voice-demo"
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Open Full Voice Demo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">SensAI</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Revolutionizing education with AI-powered learning experiences. 
                Join thousands of learners already transforming their educational journey.
              </p>
              <div className="flex space-x-4">
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <Users className="w-4 h-4 mr-1" />
                  10,000+ Students
                </div>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <BookOpen className="w-4 h-4 mr-1" />
                  500+ Courses
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li><a href="#" className="hover:text-blue-600">Features</a></li>
                <li><a href="#" className="hover:text-blue-600">Pricing</a></li>
                <li><a href="#" className="hover:text-blue-600">API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li><a href="#" className="hover:text-blue-600">Help Center</a></li>
                <li><a href="#" className="hover:text-blue-600">Contact</a></li>
                <li><a href="#" className="hover:text-blue-600">Status</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © 2025 SensAI. All rights reserved.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 md:mt-0">
              Made with ❤️ for the future of education
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

# Voice Onboarding Agent for SensAI

A complete full-stack voice-guided onboarding system that helps new users navigate SensAI's LMS through natural speech interactions.

## Overview

The Voice Onboarding Agent provides an AI-powered voice assistant that guides users through key onboarding flows:
- Account creation and signup
- Course discovery and enrollment  
- First assignment submission
- Platform navigation assistance

## Architecture

### Frontend Components

- **VoiceOnboardingProvider** (`src/providers/VoiceOnboardingProvider.tsx`)
  - React Context provider for global voice state management
  - Handles speech recognition, intent processing, and action execution
  - Manages onboarding flow progression

- **VoiceOnboardingAgent** (`src/components/VoiceOnboardingAgent.tsx`)
  - Main UI component with floating voice interface
  - Speech-to-text input and text-to-speech output
  - Visual feedback and step progression indicators

- **Voice Types** (`src/types/voice.ts`)
  - TypeScript definitions for voice system interfaces
  - OnboardingStep, VoiceIntent, and response types

- **Voice Utilities** (`src/lib/voiceUtils.ts`)
  - Speech synthesis and recognition utilities
  - Element highlighting and DOM manipulation
  - Local intent recognition functions

- **API Client** (`src/lib/api.ts`)
  - Voice endpoint integration functions
  - Session management and analytics

### Backend Services

- **Voice Routes** (`src/api/routes/voice.py`)
  - FastAPI endpoints for voice session management
  - OpenAI-powered intent recognition
  - Session analytics and tracking

- **Database Layer** (`src/api/db/voice.py`)
  - Voice session and analytics database operations
  - Intent logging for ML training data
  - Session state persistence

- **Database Schema** (`src/api/db/voice_migration.py`)
  - SQLite tables for voice sessions, analytics, and intents
  - Indexes for performance optimization

## Features

### Voice Recognition
- **Web Speech API Integration**: Browser-native speech-to-text
- **Continuous Listening**: Toggle-based voice input
- **Error Handling**: Graceful fallbacks for speech recognition failures

### Intent Processing
- **AI-Powered Understanding**: OpenAI GPT-4 for natural language intent recognition
- **Local Fallbacks**: Keyword-based intent matching when AI is unavailable
- **Context Awareness**: Current page and user state influence responses

### Guided Navigation
- **Smart Routing**: Automatic navigation to relevant pages
- **Element Highlighting**: Visual focus on important UI elements
- **Step-by-Step Guidance**: Progressive onboarding flow management

### Analytics & Tracking
- **Session Analytics**: Track completion rates and user progress
- **Intent Logging**: Collect training data for model improvement
- **Performance Metrics**: Monitor system effectiveness

## Installation

### Prerequisites
- Next.js 15 with TypeScript
- FastAPI backend with Python 3.8+
- SQLite database
- OpenAI API key

### Setup Steps

1. **Database Setup**
   ```bash
   cd src/api/db
   python voice_migration.py
   ```

2. **Environment Variables**
   ```env
   # Frontend (.env.local)
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
   
   # Backend (.env)
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Frontend Dependencies**
   The voice system uses existing project dependencies:
   - React 18 with Context API
   - Lucide icons for UI
   - Tailwind CSS for styling

4. **Backend Dependencies**
   Add to requirements.txt if not present:
   ```
   openai>=1.0.0
   instructor>=0.4.0
   ```

## Usage

### Activation
The voice agent appears as a floating "Voice Guide" button in the bottom-right corner of the application.

### Voice Commands
- **"Sign up"** - Navigate to account creation
- **"Join course"** - Browse available courses  
- **"Submit assignment"** - Guide through submission process
- **"Help"** - Get context-specific assistance
- **"Repeat"** - Repeat last instruction
- **"Stop"** - End voice guidance

### Integration

The voice system integrates automatically once added to the app layout:

```tsx
// src/app/layout.tsx
<VoiceOnboardingProvider>
  {children}
  <VoiceOnboardingAgent />
</VoiceOnboardingProvider>
```

## API Endpoints

### Voice Session Management
- `POST /voice/sessions` - Create new voice session
- `POST /voice/intent` - Process voice transcript and get action
- `GET /voice/analytics` - Retrieve usage analytics

### Request/Response Examples

**Create Session:**
```json
POST /voice/sessions
{
  "user_id": 123,
  "context": {"currentUrl": "/dashboard"}
}

Response:
{
  "session_id": "uuid-here",
  "initial_step": "welcome",
  "welcome_message": "Welcome to SensAI! How can I help you today?"
}
```

**Process Intent:**
```json
POST /voice/intent
{
  "transcript": "I want to sign up for an account",
  "context": {
    "currentStep": "welcome",
    "currentUrl": "/",
    "userIsAuthenticated": false
  }
}

Response:
{
  "intent": "signup",
  "confidence": 0.95,
  "action": {
    "type": "navigate",
    "target": "/auth/signup",
    "message": "I'll help you create an account. Let me take you to the signup page."
  },
  "next_step": "signup"
}
```

## Customization

### Adding New Intents
1. Update `VoiceIntent` enum in `src/types/voice.ts`
2. Add recognition logic in `voiceUtils.ts` or backend prompt
3. Implement action handlers in `VoiceOnboardingProvider.tsx`

### Modifying Onboarding Flow
1. Update `OnboardingStep` type definition
2. Add step instructions in `getStepInstructions()`
3. Update intent processing logic for new steps

### Styling
The voice interface uses Tailwind CSS classes and can be customized by modifying the component styles in `VoiceOnboardingAgent.tsx`.

## Browser Compatibility

- **Chrome/Edge**: Full support with webkitSpeechRecognition
- **Firefox**: Limited support (may require polyfill)
- **Safari**: Partial support on iOS 14.5+
- **Mobile**: Works on modern mobile browsers

## Security Considerations

- Voice transcripts are processed server-side with OpenAI
- No persistent audio storage
- Session data includes only text transcripts
- User authentication respected throughout flow

## Performance Optimization

- Speech recognition runs locally in browser
- Intent processing cached for repeated queries
- Minimal network requests during voice interaction
- Efficient database queries with proper indexing

## Troubleshooting

### Common Issues

1. **Speech Recognition Not Working**
   - Check browser compatibility
   - Verify microphone permissions
   - Ensure HTTPS in production

2. **Intent Recognition Failing**
   - Verify OpenAI API key configuration
   - Check network connectivity
   - Review fallback logic activation

3. **Voice Synthesis Issues**
   - Check browser speech synthesis support
   - Verify audio output permissions
   - Test with different voice commands

### Debug Mode
Enable browser console to see detailed voice system logs and state changes.

## Contributing

1. Follow existing TypeScript and React patterns
2. Add comprehensive error handling for voice features
3. Include unit tests for new intent recognition logic
4. Update this README for significant changes

## Future Enhancements

- Multi-language support
- Custom voice training
- Voice biometric authentication
- Advanced conversation flows
- Integration with accessibility features

---

The Voice Onboarding Agent transforms the SensAI onboarding experience by making it accessible, intuitive, and engaging through natural voice interactions.

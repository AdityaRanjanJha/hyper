// Test the recognizeIntent function directly
import { recognizeIntent } from './src/lib/voiceUtils.js';

const testPhrases = [
  "can you explain this page to me",
  "explain this page", 
  "what does this page say",
  "tell me about this page",
  "read this page",
  "describe this screen"
];

console.log('Testing recognizeIntent function:');
testPhrases.forEach(phrase => {
  const intent = recognizeIntent(phrase);
  console.log(`"${phrase}" -> Intent: ${intent}`);
});

// Debug pattern matching for voice commands
const transcript = "can you explain this page to me";
const lowerTranscript = transcript.toLowerCase();

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

console.log('🔍 Testing transcript:', transcript);
console.log('🔍 Lowercase:', lowerTranscript);

const matches = [];
readPageKeywords.forEach(keyword => {
  if (lowerTranscript.includes(keyword)) {
    matches.push(keyword);
  }
});

console.log('✅ Matched keywords:', matches);
console.log('Should match:', matches.length > 0);

// Test specific phrases
const testPhrases = [
  "can you explain this page to me",
  "explain this page", 
  "what does this page say",
  "tell me about this page"
];

testPhrases.forEach(phrase => {
  const hasMatch = readPageKeywords.some(keyword => phrase.toLowerCase().includes(keyword));
  console.log(`"${phrase}" matches: ${hasMatch}`);
});

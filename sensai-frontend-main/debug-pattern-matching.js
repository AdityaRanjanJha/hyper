// Debug pattern matching for voice commands
const transcript1 = "can you explain this page to me";
const transcript2 = "now what should I click to add a module";

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

const findElementKeywords = [
  'what should i click', 'where should i click', 'what button should i click',
  'how do i', 'where is the', 'find the', 'show me the', 'where can i',
  'what should i click to', 'where should i click to', 'how can i',
  'where do i click to', 'what do i click to', 'which button',
  'which button should i click', 'where is the button', 'find button',
  'show me button', 'highlight button', 'where to click',
  'how to add', 'how to create', 'how to submit', 'how to join',
  'where to add', 'where to create', 'where to submit', 'where to join'
];

function testIntent(transcript, description) {
  console.log(`\n🔍 Testing: "${transcript}" (${description})`);
  const lowerTranscript = transcript.toLowerCase();
  
  const readPageMatch = readPageKeywords.some(keyword => lowerTranscript.includes(keyword));
  const findElementMatch = findElementKeywords.some(keyword => lowerTranscript.includes(keyword));
  
  console.log(`📖 Read Page Match: ${readPageMatch}`);
  console.log(`🔍 Find Element Match: ${findElementMatch}`);
  
  if (readPageMatch) {
    console.log('✅ Should trigger: read_page intent');
  } else if (findElementMatch) {
    console.log('✅ Should trigger: find_element intent');
  } else {
    console.log('❌ Should trigger: unknown intent -> backend processing');
  }
}

testIntent(transcript1, 'page reading request');
testIntent(transcript2, 'element finding request');

// Test specific element finding patterns
console.log('\n🧪 Testing element finding patterns:');
const testPhrases = [
  "what should I click to add a module",
  "how do I add a module", 
  "where is the add button",
  "how to create a course",
  "where should I click to submit"
];

testPhrases.forEach(phrase => {
  const hasMatch = findElementKeywords.some(keyword => phrase.toLowerCase().includes(keyword));
  console.log(`"${phrase}" -> find_element: ${hasMatch}`);
});

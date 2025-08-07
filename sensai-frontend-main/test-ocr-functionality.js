/**
 * Test file for OCR page content extraction functionality
 * Run this in browser console to test the functions
 */

// Test the page content extraction functions
console.log('Testing OCR Page Content Extraction...');

// Test text extraction
console.log('=== Page Text Content ===');
try {
  const textContent = extractPageTextContent();
  console.log('Text length:', textContent.length);
  console.log('First 200 chars:', textContent.substring(0, 200));
} catch (error) {
  console.error('Text extraction error:', error);
}

// Test structure extraction
console.log('\n=== Page Structure ===');
try {
  const structure = extractPageStructure();
  console.log('Title:', structure.title);
  console.log('Headings:', structure.headings.slice(0, 3));
  console.log('Forms:', structure.forms.length);
  console.log('Buttons:', structure.buttons.slice(0, 5));
  console.log('Links:', structure.links.slice(0, 3));
} catch (error) {
  console.error('Structure extraction error:', error);
}

// Test page summary
console.log('\n=== Page Summary ===');
try {
  const summary = createPageSummary();
  console.log('Summary length:', summary.length);
  console.log('Summary:', summary.substring(0, 300) + '...');
} catch (error) {
  console.error('Summary generation error:', error);
}

// Test intent recognition
console.log('\n=== Intent Recognition ===');
try {
  const testPhrases = [
    "What does this page say?",
    "Read this page",
    "Help me sign up",
    "Stop voice assistant"
  ];
  
  testPhrases.forEach(phrase => {
    const intent = recognizeIntent(phrase);
    console.log(`"${phrase}" -> ${intent}`);
  });
} catch (error) {
  console.error('Intent recognition error:', error);
}

console.log('\nOCR functionality test complete!');

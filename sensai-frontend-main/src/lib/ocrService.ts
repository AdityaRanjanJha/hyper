/**
 * Enhanced OCR Service with OpenAI Integration
 * Provides structured page analysis and intelligent content processing
 */

import { extractPageTextContent, extractPageStructure } from './voiceUtils';

export interface StructuredPageData {
  url: string;
  title: string;
  content: {
    text: string;
    headings: string[];
    buttons: string[];
    forms: Array<{
      fields: string[];
      purpose?: string;
    }>;
    links: string[];
    images: Array<{
      alt?: string;
      context?: string;
    }>;
  };
  analysis: {
    pageType: 'login' | 'dashboard' | 'course' | 'form' | 'content' | 'unknown';
    primaryActions: string[];
    userGoals: string[];
    complexity: 'simple' | 'moderate' | 'complex';
    accessibility: {
      hasLabels: boolean;
      hasHeadings: boolean;
      navigationClear: boolean;
    };
  };
  suggestions: string[];
}

export interface OpenAIPageAnalysis {
  summary: string;
  keyElements: Array<{
    type: 'button' | 'link' | 'form' | 'heading';
    text: string;
    purpose: string;
    importance: 'high' | 'medium' | 'low';
  }>;
  userIntent: string[];
  nextSteps: string[];
  accessibility: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
}

class EnhancedOCRService {
  private apiKey: string | null = null;
  private apiBase: string = 'http://localhost:8000';

  constructor() {
    // API base can be configured
    this.apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  /**
   * Extract and structure page data using multiple methods
   */
  async extractStructuredPageData(): Promise<StructuredPageData> {
    try {
      console.log('🔍 Starting structured page data extraction...');
      
      // Get basic page information
      const url = window.location.pathname;
      const title = document.title;
      
      // Extract content using existing utilities
      const textContent = extractPageTextContent();
      const structure = extractPageStructure();
      
      // Analyze page type and purpose
      const pageAnalysis = this.analyzePageType(url, structure, textContent);
      
      // Structure the data
      const structuredData: StructuredPageData = {
        url,
        title,
        content: {
          text: textContent,
          headings: structure.headings,
          buttons: structure.buttons,
          forms: structure.forms.map(form => ({
            fields: form.fields,
            purpose: this.inferFormPurpose(form.fields, form.action)
          })),
          links: structure.links,
          images: structure.images.map(img => ({
            alt: img.alt,
            context: this.inferImageContext(img.alt, img.src)
          }))
        },
        analysis: pageAnalysis,
        suggestions: this.generateSuggestions(pageAnalysis, structure)
      };

      console.log('✅ Structured page data extracted:', structuredData);
      return structuredData;
      
    } catch (error) {
      console.error('Error extracting structured page data:', error);
      // Return minimal fallback data
      return {
        url: window.location.pathname,
        title: document.title || 'Unknown Page',
        content: {
          text: 'Unable to extract page content',
          headings: [],
          buttons: [],
          forms: [],
          links: [],
          images: []
        },
        analysis: {
          pageType: 'unknown',
          primaryActions: [],
          userGoals: [],
          complexity: 'simple',
          accessibility: {
            hasLabels: false,
            hasHeadings: false,
            navigationClear: false
          }
        },
        suggestions: ['Try refreshing the page or ask for help']
      };
    }
  }

  /**
   * Send page data to OpenAI for intelligent analysis
   */
  async getOpenAIPageAnalysis(structuredData: StructuredPageData): Promise<OpenAIPageAnalysis | null> {
    try {
      console.log('🤖 Sending page data to OpenAI for analysis...');
      
      const response = await fetch(`${this.apiBase}/intelligent-voice/analyze-page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_data: structuredData,
          analysis_type: 'comprehensive'
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI analysis failed: ${response.status}`);
      }

      const analysis = await response.json();
      console.log('✅ OpenAI page analysis received:', analysis);
      
      return analysis;
      
    } catch (error) {
      console.error('OpenAI page analysis failed:', error);
      return null;
    }
  }

  /**
   * Process user query with page context using OpenAI
   */
  async processQueryWithContext(
    userQuery: string, 
    pageData: StructuredPageData,
    conversationHistory: Array<{role: string, content: string}> = []
  ): Promise<{
    response: string;
    actions: Array<{
      type: string;
      target?: string;
      message?: string;
    }>;
    confidence: number;
  } | null> {
    try {
      console.log('🤖 Processing query with context using existing voice API...');
      
      // Use the existing voice intent API that's working
      const response = await fetch(`${this.apiBase}/voice/intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'anonymous',
          utterance: userQuery,
          memory: {
            pageData: pageData,
            conversationHistory: conversationHistory.slice(-3), // Last 3 messages for context
            lastInteraction: new Date().toISOString()
          },
          currentRoute: window.location.pathname,
          pageContext: {
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
          }
        })
      });

      if (!response.ok) {
        console.warn(`Voice API returned ${response.status}, falling back to local processing`);
        return null;
      }

      const result = await response.json();
      console.log('✅ Voice API response received:', result);
      
      // Convert voice API response to our format
      return {
        response: result.responseText || result.response || 'I can help you with that.',
        actions: result.action ? [result.action] : [],
        confidence: 0.8 // Voice API responses are generally reliable
      };
      
    } catch (error) {
      console.error('Error processing query with context:', error);
      return null;
    }
  }

  /**
   * Analyze page type and purpose
   */
  private analyzePageType(url: string, structure: ReturnType<typeof extractPageStructure>, textContent: string): StructuredPageData['analysis'] {
    const lowerUrl = url.toLowerCase();
    const lowerText = textContent.toLowerCase();
    
    let pageType: StructuredPageData['analysis']['pageType'] = 'unknown';
    let primaryActions: string[] = [];
    let userGoals: string[] = [];
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';

    // Determine page type
    if (lowerUrl.includes('/login') || lowerText.includes('sign in') || lowerText.includes('log in')) {
      pageType = 'login';
      primaryActions = ['Sign in', 'Create account', 'Login with Google'];
      userGoals = ['Access account', 'Create new account', 'Reset password'];
    } else if (lowerUrl.includes('/dashboard') || lowerUrl === '/' || lowerText.includes('dashboard')) {
      pageType = 'dashboard';
      primaryActions = ['Create course', 'Join course', 'View progress'];
      userGoals = ['Manage courses', 'Track progress', 'Access content'];
    } else if (lowerUrl.includes('/course') || lowerText.includes('course') || lowerText.includes('module')) {
      pageType = 'course';
      primaryActions = ['Start lesson', 'Submit assignment', 'View progress'];
      userGoals = ['Learn content', 'Complete assignments', 'Track progress'];
    } else if (structure.forms.length > 0) {
      pageType = 'form';
      primaryActions = ['Fill form', 'Submit', 'Save progress'];
      userGoals = ['Complete form', 'Submit information', 'Save data'];
    } else if (structure.headings.length > 3 && textContent.length > 500) {
      pageType = 'content';
      primaryActions = ['Read content', 'Navigate sections', 'Take notes'];
      userGoals = ['Learn information', 'Understand content', 'Find specific details'];
    }

    // Determine complexity
    const elementCount = structure.buttons.length + structure.links.length + structure.forms.length;
    if (elementCount > 20) complexity = 'complex';
    else if (elementCount > 10) complexity = 'moderate';

    // Accessibility analysis
    const accessibility = {
      hasLabels: structure.forms.some((form: ReturnType<typeof extractPageStructure>['forms'][0]) => 
        form.fields.some((field: string) => !field.includes('Unlabeled'))
      ),
      hasHeadings: structure.headings.length > 0,
      navigationClear: structure.buttons.length > 0 || structure.links.length > 0
    };

    return {
      pageType,
      primaryActions,
      userGoals,
      complexity,
      accessibility
    };
  }

  /**
   * Infer form purpose from fields and action
   */
  private inferFormPurpose(fields: string[], action?: string): string {
    const fieldText = fields.join(' ').toLowerCase();
    
    if (fieldText.includes('email') && fieldText.includes('password')) {
      return 'Authentication';
    } else if (fieldText.includes('name') && fieldText.includes('email')) {
      return 'Registration';
    } else if (fieldText.includes('search') || fieldText.includes('query')) {
      return 'Search';
    } else if (fieldText.includes('message') || fieldText.includes('comment')) {
      return 'Communication';
    } else if (fieldText.includes('file') || fieldText.includes('upload')) {
      return 'File Upload';
    } else if (action?.includes('submit')) {
      return 'Submission';
    }
    
    return 'Data Input';
  }

  /**
   * Infer image context from alt text and source
   */
  private inferImageContext(alt?: string, src?: string): string {
    if (!alt && !src) return 'Decorative';
    
    const text = (alt || src || '').toLowerCase();
    
    if (text.includes('logo')) return 'Branding';
    if (text.includes('profile') || text.includes('avatar')) return 'User Identity';
    if (text.includes('icon')) return 'Interface Element';
    if (text.includes('chart') || text.includes('graph')) return 'Data Visualization';
    if (text.includes('course') || text.includes('lesson')) return 'Educational Content';
    
    return 'Content Image';
  }

  /**
   * Generate helpful suggestions based on page analysis
   */
  private generateSuggestions(analysis: StructuredPageData['analysis'], structure: ReturnType<typeof extractPageStructure>): string[] {
    const suggestions: string[] = [];
    
    switch (analysis.pageType) {
      case 'login':
        suggestions.push('Say "create account" to get started');
        suggestions.push('Say "sign in with Google" for quick access');
        break;
      case 'dashboard':
        suggestions.push('Say "create course" to start teaching');
        suggestions.push('Say "join course" to start learning');
        suggestions.push('Say "show my progress" to see your stats');
        break;
      case 'course':
        suggestions.push('Say "start lesson" to begin');
        suggestions.push('Say "submit assignment" when ready');
        suggestions.push('Say "read this page" for content summary');
        break;
      case 'form':
        suggestions.push('Say "help me fill this form" for guidance');
        suggestions.push('Say "what should I enter" for field help');
        break;
      default:
        suggestions.push('Say "read this page" for a summary');
        suggestions.push('Say "what can I do here" for options');
        suggestions.push('Say "help me navigate" for guidance');
    }
    
    // Add general suggestions
    if (structure.buttons.length > 5) {
      suggestions.push('Say "what should I click" to find relevant buttons');
    }
    
    return suggestions;
  }
}

// Export singleton instance
export const ocrService = new EnhancedOCRService();

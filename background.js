"use strict";

// Log that background script has started
console.log('[AI Autocomplete] Background script started');

// Use try-catch to safely access config
let apiKey = null;
try {
  importScripts('config.js');
  apiKey = CONFIG && CONFIG.GROQ_API_KEY ? CONFIG.GROQ_API_KEY : null;
  console.log('[AI Autocomplete] Config loaded, API key available:', !!apiKey);
} catch (error) {
  console.error('[AI Autocomplete] Error loading config:', error);
}

const API_URL = 'https://api.groq.com/v1/chat/completions';
const MODEL_NAME = 'llama3-8b-8192'; // Specify a Groq model 

// Store settings
let settings = {
  enabled: true,
  useTestMode: true, // Default to test mode until API key is configured
  debounceTime: 500  // Debounce time in milliseconds
};

// Timer for debouncing
let debounceTimer = null;

// Load settings
chrome.storage.local.get(['enabled', 'useTestMode', 'apiKey', 'debounceTime'], (result) => {
  if (result.enabled !== undefined) settings.enabled = result.enabled;
  if (result.useTestMode !== undefined) settings.useTestMode = result.useTestMode;
  if (result.apiKey) apiKey = result.apiKey;
  if (result.debounceTime !== undefined) settings.debounceTime = result.debounceTime;
  console.log('[AI Autocomplete] Settings loaded:', {
    enabled: settings.enabled,
    useTestMode: settings.useTestMode,
    apiKeyAvailable: !!apiKey,
    debounceTime: settings.debounceTime
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[AI Autocomplete] Message received:', request.type || request.text);
  
  // Test connection message
  if (request.text === "TEST_CONNECTION") {
    console.log('[AI Autocomplete] Test connection message received');
    sendResponse({ status: "BACKGROUND_SCRIPT_ACTIVE" });
    return true;
  }
  
  // Update API key
  if (request.action === 'updateApiKey') {
    apiKey = request.apiKey;
    chrome.storage.local.set({ apiKey: request.apiKey });
    console.log('[AI Autocomplete] API key updated');
    sendResponse({ success: true });
    return true;
  }
  
  // Skip if disabled
  if (!settings.enabled) {
    console.log('[AI Autocomplete] Extension disabled');
    if (request.type === 'TEXT_BOX_UPDATED') {
      sendResponse({ suggestion: '', error: 'Extension is disabled' });
    }
    return true;
  }
  
  if (request.type === 'TEXT_BOX_UPDATED') {
    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Set a new timer to debounce requests
    debounceTimer = setTimeout(() => {
      updateTextbox(request, sender);
    }, settings.debounceTime);
    
    return true; // Keep the message channel open for async response
  }
  
  return true; // Keep the message channel open for async response
});

async function updateTextbox(request, sender) {
  try {
    const textBoxContent = request.textBoxContent;
    const context = request.context || {};
    
    // Skip if content is too short
    if (!textBoxContent || textBoxContent.length < 3) {
      console.log('[AI Autocomplete] Text too short, skipping');
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'COMPLETION_RECEIVED',
        completion: '',
        error: 'Text too short'
      });
      return;
    }

    // Use test mode if API key not available or test mode enabled
    if (!apiKey || settings.useTestMode) {
      console.log('[AI Autocomplete] Using test mode');
      
      // Simple test logic for autocompletion
      let suggestions = {
        'he': 'hello',
        'th': 'thank you',
        'wo': 'would you like to',
        'co': 'could you please',
        'pl': 'please help me with',
        'I ': 'think that',
        'do': 'don\'t worry about',
        'wh': 'what do you think about',
        'ho': 'how can I help you',
        'to': 'today is a great day'
      };
      
      // Find matching prefix
      let completion = '';
      const lastWord = textBoxContent.split(/\s+/).pop().toLowerCase();
      
      Object.keys(suggestions).forEach(prefix => {
        if (lastWord.startsWith(prefix)) {
          const suggestion = suggestions[prefix];
          if (suggestion.toLowerCase().startsWith(lastWord.toLowerCase())) {
            // Only include the non-typed part
            completion = suggestion.substring(lastWord.length);
          } else {
            // Include the whole suggestion with a space
            completion = ' ' + suggestion;
          }
        }
      });
      
      // Default suggestion if no match
      if (!completion) {
        completion = ' is a great choice';
      }
      
      // Send back the suggestion
      setTimeout(() => {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'COMPLETION_RECEIVED',
          completion: completion,
          lastWord: lastWord
        });
      }, 300);
      
      return;
    }

    console.log('[AI Autocomplete] Calling Groq API');
    
    // Extract context information
    const contextInfo = `
    Page Title: ${context.title || ''}
    Page Description: ${context.description || ''}
    Nearby Text: ${context.nearbyText || ''}
    Input Field: ${context.inputContext?.label || ''} ${context.inputContext?.placeholder || ''}
    `;
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        'model': MODEL_NAME,
        'messages': [
          { 
            "role": "system", 
            "content": "You are an AI autocomplete assistant. Provide short, helpful completions for what the user is typing. Only respond with the completion text itself, no explanations. Keep completions natural, short (2-5 words), and contextually appropriate."
          },
          { 
            "role": "user", 
            "content": `Complete this text (provide only a brief continuation): "${textBoxContent}"

Context about the page:
${contextInfo}`
          }
        ],
        'temperature': 0.3,
        'max_tokens': 20
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    let completion = data.choices[0].message.content.trim();
    
    // Format completion (add space if needed)
    if (completion && !completion.startsWith(' ') && !textBoxContent.endsWith(' ')) {
      completion = ' ' + completion;
    }
    
    console.log('[AI Autocomplete] Received completion:', completion);
    
    // Extract last word for reference
    const lastWord = textBoxContent.split(/\s+/).pop();
    
    chrome.tabs.sendMessage(sender.tab.id, {
      type: 'COMPLETION_RECEIVED',
      completion: completion,
      lastWord: lastWord
    });
    
  } catch (error) {
    console.error('[AI Autocomplete] Error:', error);
    chrome.tabs.sendMessage(sender.tab.id, {
      type: 'COMPLETION_RECEIVED',
      error: error.message
    });
  }
}
// Add debugging to help identify issues
console.log('[AI Autocomplete] Content script loaded on page:', window.location.href);

// Track active elements and suggestions
let activeElement = null;
let currentSuggestion = '';
let debounceTimer = null;
let suggestionTooltip = null;
let hasTypedSinceCompletion = true;
let lastCompletionTime = 0;

// Import utils functions
function loadUtils() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('utils.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Settings
let settings = {
  enabled: true,
  debounceTime: 500,
  alternativesEnabled: true
};

// Setup event listeners
function setupListeners() {
  console.log('[AI Autocomplete] Setting up listeners');
  document.addEventListener('focusin', handleFocusIn);
  document.addEventListener('keydown', handleKeyDown, true);
}

// Handle focus on input elements
function handleFocusIn(event) {
  const target = event.target;
  console.log('[AI Autocomplete] Focus detected on:', target.tagName, 'Type:', target.type, 'ContentEditable:', target.isContentEditable);
  
  if (isValidInputField(target)) {
    console.log('[AI Autocomplete] Adding listeners to input field');
    activeElement = target;
    target.addEventListener('input', handleInput);
    target.addEventListener('blur', () => {
      removeTooltip();
      activeElement = null;
    });
  }
}

// Handle input events on tracked elements
function handleInput(event) {
  if (!settings.enabled) return;
  
  const element = event.target;
  const content = getEditorContent(element);
  const cursorPos = getCursorPosition(element);
  
  // Set hasTypedSinceCompletion to true for real user input
  if (event.inputType && 
      (event.inputType.startsWith('insert') || event.inputType === 'deleteContentBackward')) {
    hasTypedSinceCompletion = true;
  }
  
  // Clear previous timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // Remove existing tooltip
  removeTooltip();
  
  // Skip if content is too short
  if (content.length < 3) {
    return;
  }
  
  // Debounce input to avoid excessive API calls
  debounceTimer = setTimeout(() => {
    // Gather context from the page
    const context = {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      nearbyText: getNearbyText(element),
      inputContext: {
        placeholder: element instanceof HTMLInputElement ? element.placeholder : '',
        label: getInputLabel(element),
        name: element instanceof HTMLInputElement ? element.name : '',
        type: element instanceof HTMLInputElement ? element.type : 'text'
      }
    };
    
    sendTextForCompletion(content, cursorPos, context);
  }, settings.debounceTime);
}

// Send text to background script for completion
function sendTextForCompletion(text, cursorPos, context) {
  console.log('[AI Autocomplete] Sending text for completion:', {
    text: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
    cursorPos,
    hasTypedSinceCompletion
  });
  
  chrome.runtime.sendMessage({ 
    type: 'TEXT_BOX_UPDATED',
    textBoxContent: text,
    cursorPosition: cursorPos,
    context: context,
    hasTypedSinceCompletion: hasTypedSinceCompletion
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[AI Autocomplete] Error sending message:', chrome.runtime.lastError);
    }
  });
}

// Handle completion response from background script
function handleCompletionResponse(response) {
  console.log('[AI Autocomplete] Received completion response:', response);
  
  // Exit if no active element
  if (!activeElement) {
    console.log('[AI Autocomplete] No active element, ignoring suggestion');
    return;
  }
  
  // Handle errors
  if (response && response.error) {
    console.error('[AI Autocomplete] Error received:', response.error);
    showErrorTooltip(response.error);
    return;
  }
  
  // Store suggestion
  if (response && response.completion) {
    currentSuggestion = response.completion;
    console.log('[AI Autocomplete] Setting suggestion:', currentSuggestion);
    
    // Only show tooltip if suggestion is not empty
    if (currentSuggestion.trim()) {
      showSuggestionTooltip(currentSuggestion, response.alternatives || []);
    }
  } else {
    console.log('[AI Autocomplete] No suggestion received or empty suggestion');
  }
}

// Apply the current suggestion
function applySuggestion(suggestion = currentSuggestion, alternativeIndex = -1) {
  if (!activeElement) return;
  
  // Use alternative if specified
  const textToInsert = alternativeIndex >= 0 ? 
    document.querySelectorAll('.ai-autocomplete-alternative')[alternativeIndex]?.dataset.text || suggestion : 
    suggestion;
  
  console.log('[AI Autocomplete] Applying suggestion:', textToInsert);
  
  const element = activeElement;
  
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    const cursorPos = element.selectionStart;
    const currentValue = element.value;
    
    // Insert the suggestion at cursor position
    element.value = currentValue.slice(0, cursorPos) + 
                   textToInsert + 
                   currentValue.slice(cursorPos);
                   
    // Move cursor to end of inserted text
    const newPosition = cursorPos + textToInsert.length;
    element.selectionStart = element.selectionEnd = newPosition;
    
    // Trigger input event for any listeners
    const inputEvent = new Event('input', { bubbles: true });
    element.dispatchEvent(inputEvent);
  } else if (element.isContentEditable) {
    try {
      document.execCommand('insertText', false, textToInsert);
    } catch (e) {
      console.error('[AI Autocomplete] execCommand failed:', e);
    }
  }
  
  // Update tracking variables
  lastCompletionTime = Date.now();
  hasTypedSinceCompletion = false;
  
  // Clear suggestion and remove tooltip
  currentSuggestion = '';
  removeTooltip();
}

// Handle keydown events for applying suggestions
function handleKeyDown(event) {
  if (!suggestionTooltip || !activeElement) return;
  
  // Tab to accept suggestion
  if (event.key === 'Tab' && currentSuggestion) {
    event.preventDefault(); // Prevent default tab behavior
    applySuggestion();
  }
  
  // Number keys for alternatives
  else if (event.key >= '1' && event.key <= '3' && suggestionTooltip.querySelectorAll('.ai-autocomplete-alternative').length > 0) {
    const index = parseInt(event.key) - 1;
    const alternatives = suggestionTooltip.querySelectorAll('.ai-autocomplete-alternative');
    
    if (index < alternatives.length) {
      event.preventDefault();
      applySuggestion(alternatives[index].dataset.text, index);
    }
  }
  
  // Escape to dismiss
  else if (event.key === 'Escape') {
    event.preventDefault();
    removeTooltip();
  }
}

// Show suggestion tooltip
function showSuggestionTooltip(suggestion, alternatives = []) {
  // Remove existing tooltip
  removeTooltip();
  
  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'ai-autocomplete-tooltip';
  
  // Add primary suggestion
  const suggestionElement = document.createElement('div');
  suggestionElement.className = 'ai-autocomplete-suggestion';
  suggestionElement.textContent = suggestion;
  tooltip.appendChild(suggestionElement);
  
  // Add alternatives if available
  if (settings.alternativesEnabled && alternatives && alternatives.length > 0) {
    const altContainer = document.createElement('div');
    altContainer.className = 'ai-autocomplete-alternatives-container';
    
    alternatives.forEach((alt, index) => {
      if (alt.trim()) {
        const altElement = document.createElement('div');
        altElement.className = 'ai-autocomplete-alternative';
        altElement.dataset.text = alt;
        altElement.innerHTML = `<span class="ai-autocomplete-key">${index + 1}</span> ${alt}`;
        altContainer.appendChild(altElement);
      }
    });
    
    if (altContainer.children.length > 0) {
      tooltip.appendChild(altContainer);
    }
  }
  
  // Add hint text about using Tab
  const hint = document.createElement('div');
  hint.className = 'ai-autocomplete-hint';
  hint.textContent = alternatives.length > 0 ? 
    'Press Tab to accept or 1-3 for alternatives' : 
    'Press Tab to accept';
  tooltip.appendChild(hint);
  
  // Calculate position relative to input field
  if (activeElement) {
    const rect = activeElement.getBoundingClientRect();
    const cursorPos = getCursorPosition(activeElement);
    
    // Get text width (simplified calculation)
    const content = getEditorContent(activeElement);
    const textBeforeCursor = content.substring(0, cursorPos);
    
    // Create temporary element for text measurement
    const measureElement = document.createElement('span');
    measureElement.style.visibility = 'hidden';
    measureElement.style.position = 'absolute';
    measureElement.style.whiteSpace = 'pre';
    measureElement.style.font = window.getComputedStyle(activeElement).font;
    measureElement.textContent = textBeforeCursor;
    document.body.appendChild(measureElement);
    
    // Calculate position
    const textWidth = measureElement.getBoundingClientRect().width;
    document.body.removeChild(measureElement);
    
    // Position tooltip
    tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    tooltip.style.left = `${rect.left + window.scrollX + Math.min(textWidth, rect.width)}px`;
    
    // Ensure tooltip fits in viewport
    document.body.appendChild(tooltip);
    const tooltipRect = tooltip.getBoundingClientRect();
    
    if (tooltipRect.right > window.innerWidth) {
      tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
    }
    
    if (tooltipRect.bottom > window.innerHeight) {
      tooltip.style.top = `${rect.top + window.scrollY - tooltipRect.height - 5}px`;
    }
  }
  
  // Store reference to current tooltip
  suggestionTooltip = tooltip;
}

// Show error tooltip
function showErrorTooltip(errorMessage) {
  const tooltip = document.createElement('div');
  tooltip.className = 'ai-autocomplete-tooltip ai-autocomplete-error';
  tooltip.textContent = errorMessage;
  
  if (activeElement) {
    const rect = activeElement.getBoundingClientRect();
    tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;
  }
  
  document.body.appendChild(tooltip);
  suggestionTooltip = tooltip;
  
  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    if (suggestionTooltip === tooltip) {
      removeTooltip();
    }
  }, 3000);
}

// Remove tooltip
function removeTooltip() {
  if (suggestionTooltip && suggestionTooltip.parentNode) {
    suggestionTooltip.parentNode.removeChild(suggestionTooltip);
    suggestionTooltip = null;
  }
}

// Show notification
function showNotification(message, duration = 3000) {
  const notification = document.createElement('div');
  notification.className = 'ai-autocomplete-notification';
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);
}

// Continue content.js implementation

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'COMPLETION_RECEIVED') {
    handleCompletionResponse(request);
  }
});

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get(['enabled', 'debounceTime', 'alternativesEnabled'], (result) => {
    settings.enabled = result.enabled !== undefined ? result.enabled : true;
    settings.debounceTime = result.debounceTime || 500;
    settings.alternativesEnabled = result.alternativesEnabled !== undefined ? result.alternativesEnabled : true;
    console.log('[AI Autocomplete] Settings loaded:', settings);
  });
}

// Check if element is a valid input field
function isValidInputField(element) {
  if (!element) return false;

  // Basic input types
  if (element instanceof HTMLInputElement) {
    const validTypes = ['text', 'search', 'url', 'email', 'tel'];
    return validTypes.includes(element.type.toLowerCase());
  }

  // Textarea
  if (element instanceof HTMLTextAreaElement) {
    return true;
  }

  // Contenteditable elements
  if (element.isContentEditable) {
    return true;
  }

  return false;
}

// Get content from different types of input fields
function getEditorContent(element) {
  if (!element) return '';

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value;
  }

  if (element.isContentEditable) {
    return element.textContent;
  }

  return '';
}

// Get cursor position in input field
function getCursorPosition(element) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.selectionStart;
  }

  if (element.isContentEditable) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      return range.startOffset;
    }
  }

  return 0;
}

// Get input label text
function getInputLabel(input) {
  // Check for aria-label
  if (input.getAttribute('aria-label')) {
    return input.getAttribute('aria-label');
  }
  
  // Check for associated label element
  const id = input.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) {
      return label.textContent;
    }
  }
  
  // Check for parent label
  const parentLabel = input.closest('label');
  if (parentLabel) {
    return parentLabel.textContent;
  }
  
  // Check for preceding label or text
  const previousElement = input.previousElementSibling;
  if (previousElement && (previousElement.tagName === 'LABEL' || previousElement.tagName === 'SPAN')) {
    return previousElement.textContent;
  }
  
  return '';
}

// Get text from elements near the input field
function getNearbyText(element, maxChars = 200) {
  if (!element) return '';
  
  // Get parent container
  let container = element.parentElement;
  for (let i = 0; i < 3 && container; i++) {
    container = container.parentElement; // Go up a few levels
  }
  
  if (!container) container = document.body;
  
  // Get text from headings and paragraphs
  const textElements = container.querySelectorAll('h1, h2, h3, h4, h5, p, label');
  let text = '';
  
  for (const el of textElements) {
    if (el !== element && !el.contains(element)) {
      text += ' ' + el.textContent;
    }
    
    if (text.length > maxChars) {
      break;
    }
  }
  
  return text.trim().substring(0, maxChars);
}

// Send a test message to verify communication with background script
chrome.runtime.sendMessage({ text: "TEST_CONNECTION" }, (response) => {
  console.log('[AI Autocomplete] Test connection response:', response);
});

// Load settings and initialize listeners
loadSettings();
setupListeners();
showNotification('AI Autocomplete active');
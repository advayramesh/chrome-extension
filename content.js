document.addEventListener('focusin', (event) => {
  if (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'INPUT' && event.target.type === 'text') {
    const textField = event.target;
    textField.addEventListener('input', handleInput);
    textField.addEventListener('keydown', handleKeyDown);
  }
});

function handleInput(event) {
  const textField = event.target;
  const text = textField.value;
  // Send text to background script for AI processing
  chrome.runtime.sendMessage({ text }, (response) => {
    if (response.suggestion) {
      // Display suggestion inline
      displaySuggestion(textField, response.suggestion);
    }
  });
}

function handleKeyDown(event) {
  if (event.key === 'Tab') {
    event.preventDefault();
    // Complete the text with the suggestion
    completeText(event.target);
  }
}

function displaySuggestion(textField, suggestion) {
  // Logic to display suggestion inline
}

function completeText(textField) {
  // Logic to complete text with suggestion
} 
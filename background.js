// Import the configuration
importScripts('config.js');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { text } = request;
  // Call Groq API to get suggestion
  fetch('https://api.groq.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}` // Use the API key from config
    },
    body: JSON.stringify({
      prompt: text,
      max_tokens: 50, // Adjust as needed
      temperature: 0.7 // Adjust as needed
    })
  })
  .then(response => response.json())
  .then(data => {
    const suggestion = data.choices[0].text.trim(); // Adjust based on Groq API response structure
    sendResponse({ suggestion });
  })
  .catch(error => {
    console.error('Error fetching AI suggestion:', error);
    sendResponse({ suggestion: '' });
  });
  return true; // Keep the message channel open for async response
}); 
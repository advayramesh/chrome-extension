document.addEventListener('DOMContentLoaded', function() {
    const enabledToggle = document.getElementById('enabled');
    const statusDiv = document.querySelector('.status');
    const apiKeyInput = document.getElementById('api-key');
    const saveApiKeyButton = document.getElementById('save-api-key');
    
    // Load saved state
    chrome.storage.local.get(['enabled', 'useTestMode', 'apiKey'], function(result) {
      // Handle enabled state
      const isEnabled = result.enabled !== undefined ? result.enabled : true;
      enabledToggle.checked = isEnabled;
      updateStatusMessage(isEnabled);
      
      // Set API key if available
      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
        apiKeyInput.type = 'password'; // Hide the API key by default
      }
      
      // Add test mode toggle
      const testModeContainer = document.createElement('div');
      testModeContainer.className = 'toggle-container';
      testModeContainer.innerHTML = `
        <span class="toggle-label">Use test mode (no API calls):</span>
        <label class="toggle">
            <input type="checkbox" id="test-mode">
            <span class="slider"></span>
        </label>
      `;
      
      document.querySelector('.api-key-container').before(testModeContainer);
      
      const testModeToggle = document.getElementById('test-mode');
      testModeToggle.checked = result.useTestMode === true;
      
      // Add event listener for test mode toggle
      testModeToggle.addEventListener('change', function() {
        const useTestMode = testModeToggle.checked;
        chrome.storage.local.set({useTestMode: useTestMode});
        
        // Update status message
        if (useTestMode) {
          showMessage('Test mode enabled - no API calls will be made', 'warning');
        } else {
          showMessage('Using real API calls', 'info');
        }
      });
    });
    
    // Save state when changed
    enabledToggle.addEventListener('change', function() {
      const isEnabled = enabledToggle.checked;
      chrome.storage.local.set({enabled: isEnabled});
      updateStatusMessage(isEnabled);
      
      // Notify all tabs about the state change
      chrome.tabs.query({}, function(tabs) {
        tabs.forEach(function(tab) {
          chrome.tabs.sendMessage(tab.id, {action: 'toggleEnabled', enabled: isEnabled})
            .catch(() => {}); // Ignore errors for inactive tabs
        });
      });
      
      showMessage(`Extension ${isEnabled ? 'enabled' : 'disabled'}`, isEnabled ? 'success' : 'warning');
    });
    
    // Save API key
    saveApiKeyButton.addEventListener('click', function() {
      const apiKey = apiKeyInput.value.trim();
      
      if (!apiKey) {
        showMessage('Please enter a valid API key', 'error');
        return;
      }
      
      // Save API key to storage
      chrome.storage.local.set({apiKey: apiKey}, function() {
        // Update config.js with the new API key
        chrome.runtime.sendMessage({
          action: 'updateApiKey',
          apiKey: apiKey
        }, function(response) {
          if (response && response.success) {
            showMessage('API key saved successfully', 'success');
            
            // Disable test mode if API key is provided
            chrome.storage.local.set({useTestMode: false});
            const testModeToggle = document.getElementById('test-mode');
            if (testModeToggle) {
              testModeToggle.checked = false;
            }
          } else {
            showMessage('Failed to update API key', 'error');
          }
        });
      });
    });
    
    // Toggle API key visibility
    apiKeyInput.addEventListener('dblclick', function() {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    });
    
    // Function to update status message
    function updateStatusMessage(isEnabled) {
      if (isEnabled) {
        statusDiv.textContent = 'Extension is active and ready to provide suggestions';
        statusDiv.style.borderLeftColor = '#7cb342';
        statusDiv.style.backgroundColor = '#f1f8e9';
      } else {
        statusDiv.textContent = 'Extension is currently disabled';
        statusDiv.style.borderLeftColor = '#ffb300';
        statusDiv.style.backgroundColor = '#fff8e1';
      }
    }
    
    // Function to show temporary message
    function showMessage(text, type = 'info', duration = 2000) {
      const messageElement = document.createElement('div');
      messageElement.className = 'message ' + type;
      messageElement.textContent = text;
      messageElement.style.padding = '8px';
      messageElement.style.marginTop = '10px';
      messageElement.style.borderRadius = '4px';
      messageElement.style.fontSize = '13px';
      messageElement.style.transition = 'opacity 0.3s ease';
      
      // Set colors based on type
      if (type === 'success') {
        messageElement.style.backgroundColor = '#e8f5e9';
        messageElement.style.borderLeft = '4px solid #4caf50';
      } else if (type === 'warning') {
        messageElement.style.backgroundColor = '#fff8e1';
        messageElement.style.borderLeft = '4px solid #ffb300';
      } else if (type === 'error') {
        messageElement.style.backgroundColor = '#ffebee';
        messageElement.style.borderLeft = '4px solid #f44336';
      } else {
        messageElement.style.backgroundColor = '#e3f2fd';
        messageElement.style.borderLeft = '4px solid #2196f3';
      }
      
      // Add to DOM
      document.body.appendChild(messageElement);
      
      // Remove after duration
      setTimeout(() => {
        messageElement.style.opacity = '0';
        setTimeout(() => {
          if (messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
          }
        }, 300);
      }, duration);
    }
    
    // Add version info
    const versionInfo = document.createElement('div');
    versionInfo.className = 'version-info';
    versionInfo.textContent = 'v1.0.0';
    versionInfo.style.fontSize = '11px';
    versionInfo.style.color = '#999';
    versionInfo.style.textAlign = 'right';
    versionInfo.style.marginTop = '15px';
    document.body.appendChild(versionInfo);
  });
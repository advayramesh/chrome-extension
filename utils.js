// Helper functions for AI Autocomplete Extension

// Helper function to get input label text
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
  
  // Helper function to get nearby text content
  function getNearbyText(element, maxDistance = 300) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Get all text nodes within the viewport
    const textNodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
  
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement) continue;
      
      const nodeRect = node.parentElement.getBoundingClientRect();
      const nodeCenterX = nodeRect.left + nodeRect.width / 2;
      const nodeCenterY = nodeRect.top + nodeRect.height / 2;
      
      // Calculate distance
      const distance = Math.sqrt(
        Math.pow(centerX - nodeCenterX, 2) + 
        Math.pow(centerY - nodeCenterY, 2)
      );
      
      if (distance <= maxDistance) {
        const text = node.textContent.trim();
        if (text.length > 0) {
          textNodes.push({
            text: text,
            distance: distance
          });
        }
      }
    }
    
    // Sort by distance and return concatenated text
    return textNodes
      .sort((a, b) => a.distance - b.distance)
      .map(node => node.text)
      .join(' ');
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
  
    // Contenteditable elements (like Google Docs, rich text editors)
    if (element.isContentEditable) {
      return true;
    }
  
    // Monaco editor (VS Code-like editors)
    if (element.classList && element.classList.contains('monaco-editor')) {
      return true;
    }
  
    // CodeMirror editor
    if (element.classList && element.classList.contains('CodeMirror')) {
      return true;
    }
  
    // Check for common rich text editor frameworks
    const editorClasses = [
      'ql-editor', // Quill
      'ProseMirror', // ProseMirror
      'tox-edit-area', // TinyMCE
      'cke_editable', // CKEditor
      'ace_editor', // Ace Editor
      'froala-editor', // Froala
      'trumbowyg-editor', // Trumbowyg
      'medium-editor' // Medium Editor
    ];
  
    if (element.classList) {
      return editorClasses.some(className => element.classList.contains(className));
    }
  
    return false;
  }
  
  // Get text content from different types of editors
  function getEditorContent(element) {
    if (!element) return '';
  
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value;
    }
  
    if (element.isContentEditable) {
      return element.textContent;
    }
  
    // Handle different editor frameworks
    if (element.classList && element.classList.contains('monaco-editor')) {
      // Monaco editor handling
      const model = element.querySelector('.monaco-editor')?._modelData?.model;
      return model ? model.getValue() : '';
    }
  
    if (element.classList && element.classList.contains('CodeMirror')) {
      // CodeMirror handling
      return element.CodeMirror?.getValue() || '';
    }
  
    // Default to textContent
    return element.textContent || '';
  }
  
  // Get cursor position from different types of editors
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
  
    // Handle different editor frameworks
    if (element.classList && element.classList.contains('monaco-editor')) {
      const model = element.querySelector('.monaco-editor')?._modelData?.model;
      const position = model?.getPosition();
      return position ? model.getOffsetAt(position) : 0;
    }
  
    if (element.classList && element.classList.contains('CodeMirror')) {
      const cm = element.CodeMirror;
      if (cm) {
        const pos = cm.getCursor();
        return cm.indexFromPos(pos);
      }
    }
  
    return 0;
  }
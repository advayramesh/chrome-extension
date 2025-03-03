# AI Autocomplete Chrome Extension

A simple Chrome extension that provides AI-powered text completion suggestions as you type in any text field.

## What it does

- Shows suggestions as you type in text fields
- Press Tab to accept suggestions
- Works in most text inputs across the web

## Setup

1. Clone this repo or download the files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your toolbar

## How to use

1. Click on any text field on a webpage
2. Start typing (at least 3 characters)
3. When a suggestion appears, press Tab to accept it

## Test mode

By default, the extension runs in "test mode" with predefined suggestions. To use the Groq API:

1. Get a Groq API key from groq.com
2. Click the extension icon and enter your API key
3. Disable "Test mode"

## Files

- `manifest.json`: Extension configuration
- `background.js`: Handles API calls and suggestion generation
- `content.js`: Monitors text fields and displays suggestions
- `popup.html/js`: Settings UI
- `styles.css`: Tooltip styling
- `config.js`: API key storage

## Known issues

- Doesn't work in Google Docs or other complex editors
- May have positioning issues in some layouts
- Test mode only has limited predefined suggestions

## Workflow for developers

1. Make changes to the code
2. Reload the extension in `chrome://extensions/` (click the refresh icon)
3. Test in a simple webpage with text inputs
4. Check the console for logs with "[AI Autocomplete]" prefix
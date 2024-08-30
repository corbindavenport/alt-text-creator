const isFirefox = chrome.runtime.getURL('').startsWith('moz-extension://');

// Chromium can't load shared.js alongside background.js in the manifest.json file
if (!isFirefox) {
  importScripts('/js/shared.js');
}

// Handle offscreen document for clipboard operations
let creating; // A global promise to avoid concurrency issues
async function setupOffscreenDocument(path) {
  // Check all windows controlled by the service worker to see if one
  // of them is the offscreen document with the given path
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
  if (existingContexts.length > 0) {
    return;
  }
  // create offscreen document
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['CLIPBOARD'],
      justification: 'Copy text to clipboard',
    });
    await creating;
    creating = null;
  }
}

// Function to run alternate image generation based on user setting
async function initAltText(imageUrl) {
  // Check for settings and API keys
  const settings = await chrome.storage.sync.get();
  if ((settings.hasOwnProperty('openAIkey') && (settings.openAIkey != ''))) {
    // Generate alternate text
    var response = await genAltTextGPT(imageUrl, settings.openAIkey, settings.altTextGenerator);
    // Set notification options
    var data = {
      'type': 'basic',
      'iconUrl': chrome.runtime.getURL('img/icon_x128.png'),
      'message': response,
      'title': 'Alternate text copied to clipboard',
    }
    // Copy text to clipboard
    if (isFirefox) {
      await navigator.clipboard.writeText(response);
    } else {
      // Chromium browsers need to use an offscreen document
      await setupOffscreenDocument('copy.html');
      chrome.runtime.sendMessage({
        type: 'copy-clipboard',
        target: 'offscreen',
        data: response
      });
    }
    // Display the notification
    chrome.notifications.create(data, function (id) {
      // Close notification after five seconds
      setTimeout(function () {
        chrome.notifications.clear(id)
      }, 5000);
    });
  } else {
    showErrorNotif('You must provide an OpenAPI key. Click to open settings.', true);
  }
}

// Function to display error notification
function showErrorNotif(message, optionsLink) {
  // Set notification options
  var data = {
    'type': 'basic',
    'message': message,
    'iconUrl': chrome.runtime.getURL('img/icon_x128.png'),
    'title': 'Error',
  }
  // If optionsLink is true, show settings page when the notification is clicked
  handleNotif = function (id) {
    chrome.notifications.onClicked.addListener(function (id) {
      if (optionsLink) {
        chrome.runtime.openOptionsPage();
      }
    })
  }
  // Display the notification
  chrome.notifications.create(data, handleNotif);
}

chrome.runtime.onInstalled.addListener(async (details) => {
  // Wait for storage sync
  await chrome.storage.sync.get();
  // Show welcome message
  if (details.reason === 'install' || details.reason === 'update') {
    chrome.tabs.create({ 'url': chrome.runtime.getURL('main.html') });
  };
  // Create context menu item
  chrome.contextMenus.create({
    id: 'generate-alt',
    title: 'Create Alt Text',
    contexts: ['image']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  console.log('Recieved page from context menu:', info)
  if (info.menuItemId === 'generate-alt') {
    initAltText(info.srcUrl);
  }
});

// Functions for sidebar and offscreen page
chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
  if (request.action == 'closeOffscreen') {
    chrome.offscreen.closeDocument();
  }
});
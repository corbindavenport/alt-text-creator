// Show welcome message
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    // This will be enabled later
    // chrome.tabs.create({ 'url': chrome.runtime.getURL('welcome.html') });
  };
});

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

// Function to generate alternate text using OpenAI API
async function genAltTextGPT(imageUrl, openAIkey) {
  const localData = await chrome.storage.local.get({
    imageAltDB: {}
  });
  // Check if image was already processed
  if (imageUrl in localData.imageAltDB) {
    console.log("Image was already processed, no need to call API again.")
    return localData.imageAltDB[imageUrl]
  }
  // Set up image request
  const url = 'https://api.openai.com/v1/chat/completions';
  const data = {
    "model": "gpt-4-vision-preview",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "Generate alt text for an image that showcases the key visual elements, is concise, and under 125 characters. Do not write quotetation marks or 'Alt Text: '."
          },
          {
            "type": "image_url",
            "image_url": {
              "url": imageUrl,
              "detail": "low"
            }
          }
        ]
      }
    ],
    max_tokens: 300,
  };
  console.log('Sending to OpenAI:', data);
  // Send request
  const fetchRequest = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAIkey}`,
    },
    body: JSON.stringify(data),
  };
  var response = await fetch(url, fetchRequest)
  var responseData = await response.json()
  console.log("OpenAI API repsonse:", responseData)
  if (responseData.error) {
    // Show error
    return responseData.error.message
  } else if (responseData.choices[0].message.content) {
    // Add information to local storage
    const imagesdbTemp = (localData.imageAltDB || {})
    imagesdbTemp[imageUrl] = responseData.choices[0].message.content
    await chrome.storage.local.set({ imageAltDB: imagesdbTemp })
    console.log('Saved alt text to storage:', imagesdbTemp[imageUrl])
    return responseData.choices[0].message.content
  } else {
    return 'Unknown error'
  }
}

// Function to run alternate image generation based on user setting
async function initAltText(imageUrl) {
  // Check for settings and API keys
  const settings = await chrome.storage.sync.get();
    if ((settings.hasOwnProperty('openAIkey') && (settings.openAIkey != ''))) {
      // Generate alternate text
      var response = await genAltTextGPT(imageUrl, settings.openAIkey)
      // Set notification options
      var data = {
        'type': 'basic',
        'iconUrl': chrome.runtime.getURL('img/icon_x128.png'),
        'message': response,
        'title': 'Alternate text copied to clipboard',
      }
      // Copy text to clipboard using offscreen document
      await setupOffscreenDocument('copy.html');
      chrome.runtime.sendMessage({
        type: 'copy-clipboard',
        target: 'offscreen',
        data: response
      });
      // Display the notification
      chrome.notifications.create(data);
    } else if (openAIRequest) {
      showErrorNotif('You must provide an OpenAPI key. Click to open settings.', true)
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
  chrome.notifications.create(data, handleNotif)
}

// Add context menu entry for generating alt text
chrome.contextMenus.create({
  id: 'generate-alt',
  title: 'Generate Alt Text',
  contexts: ['image']
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  console.log('Recieved page from context menu:', info)
  if (info.menuItemId === 'generate-alt') {
    initAltText(info.srcUrl)
  }
});

// Close offscreen copy page when done
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action == 'closeOffscreen') {
    chrome.offscreen.closeDocument()
  }
})
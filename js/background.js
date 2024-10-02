const isFirefox = chrome.runtime.getURL('').startsWith('moz-extension://')

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

// Function to convert images into data URL format
// This is used for sending images to a local server
async function fetchImageAsDataURL(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    throw error;
  }
}


// Function to generate alternate text using OpenAI API
async function genAltTextGPT(imageUrl, openAIkey, modelName, customIp) {
  const localData = await chrome.storage.local.get({
    imageAltDB: {}
  });
  // Check if image was already processed
  if (imageUrl in localData.imageAltDB) {
    console.log("Image was already processed, no need to call API again.")
    return localData.imageAltDB[imageUrl]
  }
  // Set up prompt and request URL
  var prompt, requestUrl;
  if (modelName === 'local-server') {
    prompt = "Create a caption. Your response should be one or two sentences. Do not write 'the' as the first word. Do not write quotation marks.";
    requestUrl = `http://${customIp}/v1/chat/completions`;
  } else {
    requestUrl = 'https://api.openai.com/v1/chat/completions';
    // This works best with GPT-4 and GPT-4o
    prompt = "Generate alt text for an image that showcases the key visual elements, is concise, and is under 125 characters. Do not write quotetation marks or 'Alt Text: '.";
  }
  // Set up image request
  var data = {
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": prompt
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
  // Set AI model and other user settings
  if (modelName === 'gpt-4o') {
    data.model = 'gpt-4o';
  } else if (modelName === 'local-server') {
    // Convert image to base64 encoding, LM Studio doesn't support external images
    await fetchImageAsDataURL(imageUrl)
      .then(dataUrl => data['messages'][0]['content'][1]['image_url']['url'] = dataUrl)
      .catch(error => console.error('Error:', error));
  } else {
    // GPT-4o Mini is both the default AI model and a user-selectable option
    data.model = 'gpt-4o-mini';
  }
  // Configure fetch request
  console.log('Sending network request:', data);
  var fetchRequest = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAIkey}`,
    },
    body: JSON.stringify(data),
  };
  // Remove OpenAI key if using a custom server
  if (modelName === 'local-server') {
    delete fetchRequest['headers']['Authorization'];
  }
  // Send fetch request
  var response = await fetch(requestUrl, fetchRequest)
  var responseData = await response.json()
  console.log("API repsonse:", responseData)
  if (responseData.error) {
    // Show error
    return responseData.error.message
  } else if (responseData.choices[0].message.content) {
    // Add information to local storage
    const imagesdbTemp = (localData.imageAltDB || {});
    imagesdbTemp[imageUrl] = responseData.choices[0].message.content;
    // Limit the number of stored image descriptions to 100
    if (Object.keys(imagesdbTemp).length >= 100) {
      // Remove the oldest entry from the imageAltDB
      const oldestImageUrl = Object.keys(imagesdbTemp)[0];
      delete imagesdbTemp[oldestImageUrl]
    }
    // Save database back to storage
    await chrome.storage.local.set({ imageAltDB: imagesdbTemp });
    console.log('Saved alt text to storage:', imagesdbTemp[imageUrl]);
    return responseData.choices[0].message.content;
  } else {
    return 'Unknown error';
  }
}

// Function to run alternate image generation based on user setting
async function initAltText(imageUrl) {
  // Check for settings and API keys
  const settings = await chrome.storage.sync.get();
  if ((settings.hasOwnProperty('openAIkey') && (settings.openAIkey != '')) || settings.customIp) {
    // Generate alternate text
    var response = await genAltTextGPT(imageUrl, settings.openAIkey, settings.altTextGenerator, settings.customIp);
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
});

// Create context menu item
chrome.contextMenus.create({
  id: 'generate-alt',
  title: 'Create Alt Text',
  contexts: ['image']
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  console.log('Recieved page from context menu:', info)
  if (info.menuItemId === 'generate-alt') {
    initAltText(info.srcUrl);
  }
});

// Close offscreen copy page when done
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action == 'closeOffscreen') {
    chrome.offscreen.closeDocument();
  }
})
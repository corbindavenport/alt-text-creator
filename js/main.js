// This contains code for both the settings page and sidebar panel

// Add version number to welcome page
document.querySelector('#version').innerHTML = chrome.runtime.getManifest().version;

// Read settings from storage
chrome.storage.sync.get({
  altTextGenerator: 'gpt-4o-mini',
  openAIkey: ''
}, function (data) {
  var model = '';
  // Migrate discontinued gpt4-vision option to gpt-4o-mini
  if (data.altTextGenerator === 'gpt4-vision') {
    model = 'gpt-4o-mini';
    chrome.storage.sync.set({ altTextGenerator: model }).then(() => {
      console.log(`Migrated model setting to ${model}`);
    });
  } else {
    model = data.altTextGenerator;
  }
  if (document.documentElement.dataset.settings) {
    // Text generation service
    document.querySelector('#alt-text-generator').value = model;
    // OpenAI API key
    document.querySelector('#openai-key').value = data.openAIkey;
  }
});

// Save settings after any input change
if (document.documentElement.dataset.settings) {
  document.querySelectorAll('input,select').forEach(function (el) {
    el.addEventListener('change', function () {
      chrome.storage.sync.set({
        // Text generation service
        altTextGenerator: document.querySelector('#alt-text-generator').value,
        // OpenAI API key
        openAIkey: document.querySelector('#openai-key').value
      })
    })
  })
}

// Functions for side panel
if (document.documentElement.dataset.sidebar) {

  const imageUrlEl = document.getElementById('image-url');
  const resultEl = document.getElementById('alt-text-result');

  // Generate alt text button
  document.getElementById('generate-btn').addEventListener('click', async function () {
    if (imageUrlEl.value) {
      // Generate alternate text from other page
      const settings = await chrome.storage.sync.get();
      if ((settings.hasOwnProperty('openAIkey') && (settings.openAIkey != ''))) {
        // Generate alternate text
        var response = await genAltTextGPT(imageUrlEl.value, settings.openAIkey, settings.altTextGenerator);
        resultEl.value = response;
      } else {
        resultEl.value = 'You must provide an OpenAPI key. Open the settings and add one.';
      }
    }
  });

  // Copy test button
  document.getElementById('text-copy-btn').addEventListener('click', async function () {
    const type = "text/plain";
    const blob = new Blob([resultEl.value], { type });
    const data = [new ClipboardItem({ [type]: blob })];
    await navigator.clipboard.write(data);
  });

  // Settings button
  document.getElementById('settings-btn').addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
    window.close();
  });

}
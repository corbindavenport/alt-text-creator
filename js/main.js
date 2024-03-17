// Add version number to welcome page
document.querySelector('.version').innerHTML = chrome.runtime.getManifest().version;

// Read settings from storage
chrome.storage.sync.get({
  altTextGenerator: 'gpt4-vision',
  openAIkey: ''
}, function (data) {
  // Text generation service
  document.querySelector('#alt-text-generator').value = data.altTextGenerator;
  // OpenAI API key
  document.querySelector('#openai-key').value = data.openAIkey;
});

// Save settings after any input change
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
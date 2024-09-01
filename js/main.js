// Add version number to welcome page
document.querySelector('#version').innerHTML = chrome.runtime.getManifest().version;

// Read settings from storage
chrome.storage.sync.get({
  altTextGenerator: 'gpt-4o-mini',
  openAIkey: '',
  customIp: ''
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
  // Text generation service
  document.querySelector('#alt-text-generator').value = model;
  // OpenAI API key
  document.querySelector('#openai-key').value = data.openAIkey;
  // Custom server IP
  document.querySelector('#custom-server-ip').value = data.customIp;
});

// Save settings after any input change
document.querySelectorAll('input,select').forEach(function (el) {
  el.addEventListener('change', function () {
    chrome.storage.sync.set({
      // Text generation service
      altTextGenerator: document.querySelector('#alt-text-generator').value,
      // OpenAI API key
      openAIkey: document.querySelector('#openai-key').value,
      // Custom server IP
      customIp: document.querySelector('#custom-server-ip').value
    })
  })
})
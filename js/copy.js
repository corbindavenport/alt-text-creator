// Function to copy text 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'copy-clipboard') {
        const clipboardArea = document.getElementById('clipboard-area');
        clipboardArea.value = message.data;
        clipboardArea.select();
        document.execCommand('copy');
    }
})
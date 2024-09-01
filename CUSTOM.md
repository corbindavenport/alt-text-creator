# Custom AI models with Alt Text Creator

You can use use Alt Text Creator with a local server running an OpenAI-like API and an AI model with vision capabilities. This requires you to change the "Text generation service" to "custom server" in the extension settings, then enter the IP address and port for the server in the "custom server IP" text box.

This was tested using [LM Studio](https://lmstudio.ai/) and the [Llava-v1.5-7B-GGUF](https://huggingface.co/second-state/Llava-v1.5-7B-GGUF) model. Results were generally less consistent than GPT-4o and GPT-4o Mini.

### How to set up a custom server

1. Download [ML Studio](https://lmstudio.ai/) and open it.
2. In the Discover tab, search for an AI model with vision capabilites (like LLaVA 1.5) and download it.
3. After the download is complete, switch to the Developer tab.
4. Click the "Select a model to load" dropdown menu and select the vision model you downloaded.
5. Turn on "Enable CORS" in the settings.
6. Click the "Start Server" button.
7. Open the Alt Text Creator settings page. In Firefox, navigate to `about:addons`, find Alt Text Creator, click the three dots button, and select 'Preferences'. In Chrome or a Chrome-like browser, find Alt Text Creator in the toolbar, right-click it or click the three dots button, and select 'Options'.
8. Set the text generation service to "Custom server", then enter the IP and port provided by LM Studio. It should be something like `localhost:7250`. You do not need to enter `http://` or anything else in the text box.

This will continue working as long as LM Studio's web server is running with the vision model loaded. You can switch back to a GPT-4 model by opening the extension settings again and changing the text generation service to another option.
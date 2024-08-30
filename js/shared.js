
// Function to generate alternate text using OpenAI API
async function genAltTextGPT(imageUrl, openAIkey, modelName) {
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
    // Set AI model
    if (modelName === 'gpt-4o') {
        data.model = 'gpt-4o';
    } else {
        // GPT-4o Mini is both the default AI model and a user-selectable option
        data.model = 'gpt-4o-mini';
    }
    // Send request
    console.log('Sending to OpenAI:', data);
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
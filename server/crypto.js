// HELPER FUNCTIONS
function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// MAIN EXECUTION
async function runCryptoSandbox() {
    console.log("Starting Zero-Knowledge Client...");
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // 1. Generate Local AES-256 Key
    let activeKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 }, 
        true, 
        ["encrypt", "decrypt"] 
    );

    // 2. Prepare the Secret Message
    const secretMessage = "Explain quantum computing in one short sentence.";
    console.log("Sending message: " + secretMessage);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv }, 
        activeKey, 
        encoder.encode(secretMessage)
    );

    const rawKeyBuffer = await crypto.subtle.exportKey("raw", activeKey);
    
    const networkPayload = {
        encryptedPayload: bufferToBase64(ciphertextBuffer),
        iv: bufferToBase64(iv),
        rawKey: bufferToBase64(rawKeyBuffer) 
    };

    console.log("Transmitting secure payload to Relay Server...");
    
    try {
        const response = await fetch("http://localhost:3000/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(networkPayload)
        });
        
        if (!response.ok) throw new Error("Server returned an error");

        const serverData = await response.json();
        console.log("Encrypted package received back from server.");

        // 3. DECRYPT THE AI'S RESPONSE
        const returnIvBuffer = base64ToBuffer(serverData.returnIv);
        const encryptedResponseBuffer = base64ToBuffer(serverData.encryptedResponse);

        const decryptedResponseBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: returnIvBuffer },
            activeKey,
            encryptedResponseBuffer
        );

        const finalPlaintext = decoder.decode(decryptedResponseBuffer);
        console.log("UNLOCKED AI RESPONSE:");
        console.log(finalPlaintext);

    } catch (err) {
        console.error("Transmission failed. Check if server.js is running.", err);
    }
}

// Run the engine
runCryptoSandbox();
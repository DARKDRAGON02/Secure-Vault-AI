require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
    console.log("\n--- 🛡️ Incoming Secure Request ---");
    try {
        const { encryptedPayload, iv, rawKey } = req.body;
        const keyBuffer = Buffer.from(rawKey, 'base64');
        const ivBuffer = Buffer.from(iv, 'base64');
        const payloadBuffer = Buffer.from(encryptedPayload, 'base64');

        // 1. Decrypt User Message (AES-GCM)
        const authTag = payloadBuffer.subarray(-16);
        const ciphertext = payloadBuffer.subarray(0, -16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
        decipher.setAuthTag(authTag);
        let decryptedMessage = decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8');
        
        console.log("🔓 Decrypted Prompt:", decryptedMessage);

        // 2. Call Google Gemini (Resilient Mode)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: decryptedMessage }] }] }),
            signal: AbortSignal.timeout(30000) 
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        const aiText = data.candidates[0].content.parts[0].text;

        // 3. Re-encrypt AI Response
        const returnIv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, returnIv);
        const encryptedAi = Buffer.concat([cipher.update(aiText, 'utf8'), cipher.final()]);
        const returnTag = cipher.getAuthTag();

        // Combine ciphertext + tag for SubtleCrypto compatibility
        const finalPayload = Buffer.concat([encryptedAi, returnTag]);

        console.log("🔒 Response Re-encrypted. Sending...");
        res.json({
            encryptedResponse: finalPayload.toString('base64'),
            returnIv: returnIv.toString('base64'),
            authTag: returnTag.toString('base64')
        });
    } catch (error) {
        console.error("❌ Relay Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 VAULT RELAY ACTIVE: http://localhost:${PORT}`);
    console.log(`🔑 Key Status: [AUTHENTICATED]`);
});
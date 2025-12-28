import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

async function listModels() {
    const apiKey = process.argv[2] || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("❌ Error: No API key provided.");
        console.log("Usage: node scripts/list_models.js <YOUR_API_KEY>");
        console.log("Or set GEMINI_API_KEY in your .env file.");
        return;
    }

    console.log(`🔍 Checking Gemini API key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.error("❌ API Error:");
            console.error(`- Status: ${data.error.status}`);
            console.error(`- Message: ${data.error.message}`);
            return;
        }

        console.log("\n✅ Success! Available Gemini Models:");
        console.log("-----------------------------------");
        if (data.models && data.models.length > 0) {
            data.models.forEach(m => {
                const methods = m.supportedGenerationMethods.join(', ');
                const isFlash = m.name.includes('flash');
                const emoji = isFlash ? '⚡' : '🧠';
                console.log(`${emoji} ${m.name.replace('models/', '')}`);
                console.log(`   Methods: [${methods}]`);
            });
        } else {
            console.log("No models found in the response.");
        }
    } catch (error) {
        console.error("❌ Connection Failed:", error.message);
    }
}

listModels();

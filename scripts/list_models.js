import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY || process.argv[2];
    if (!apiKey) {
        console.error("No API key provided.");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // The listModels method is on the genAI instance
        // Note: SDK version 0.24.1 listModels:
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
        const data = await response.json();

        console.log("--- Available Gemini Models ---");
        if (data.models) {
            data.models.forEach(m => {
                console.log(`${m.name} [${m.supportedGenerationMethods.join(', ')}]`);
            });
        } else {
            console.log("No models found or error in response:", data);
        }
    } catch (error) {
        console.error("Failed to list models:", error);
    }
}

listModels();

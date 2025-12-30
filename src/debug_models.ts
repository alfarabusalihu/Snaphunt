import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ GEMINI_API_KEY not found in .env");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        console.log("📡 Fetching models via v1...");
        // The SDK doesn't have a direct listModels that takes apiVersion easily in the constructor for listing, 
        // but we can try different approaches.

        // Actually, we can just use fetch to be sure.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.error("❌ API Error:", data.error);
        } else {
            console.log("✅ Available Models (v1beta):");
            data.models.forEach((m: any) => {
                console.log(`- ${m.name} (Supports: ${m.supportedGenerationMethods.join(', ')})`);
            });
        }
    } catch (e) {
        console.error("❌ Failed to list models:", e);
    }
}

listModels();

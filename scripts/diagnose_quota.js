import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

async function diagnose() {
    const apiKey = process.env.GEMINI_API_KEY || process.argv[2];
    if (!apiKey) {
        console.error("❌ No API key found in .env or arguments.");
        return;
    }

    console.log("🔍 Starting Quota Diagnosis (Using v1 API)...");
    const genAI = new GoogleGenerativeAI(apiKey);

    // Explicitly use v1 to match the production app
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash"
    }, { apiVersion: 'v1' });

    try {
        console.log("📡 Sending test request to gemini-1.5-flash...");
        const result = await model.generateContent("Say 'Quota Test successful'");
        console.log("✅ SUCCESS:", result.response.text());
    } catch (error) {
        console.error("❌ FAILED with Error:");

        if (error.status) console.log("Status Code:", error.status);
        if (error.statusText) console.log("Status Text:", error.statusText);

        const msg = error.message || String(error);
        console.log("Message:", msg);

        if (error.errorDetails) {
            console.log("--- Detailed Quota Info ---");
            console.log(JSON.stringify(error.errorDetails, null, 2));
        }

        console.log("\n💡 ANALYSIS:");
        if (msg.includes("429")) {
            console.log("- This is a Rate Limit.");
            if (msg.includes("limit: 0")) {
                console.log("- Your DAILY limit is hit. You need a new API key or wait for the reset.");
            }
        } else if (msg.includes("404")) {
            console.log("- Model not found. This usually means the model name or API version is slightly wrong.");
        }
    }
}

diagnose();

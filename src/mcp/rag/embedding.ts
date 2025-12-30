import { GoogleGenerativeAI } from "@google/generative-ai";
import { TokenTracker } from "../tokenTracker.js";

const EMBEDDING_MODEL = "text-embedding-004";

export async function embedQuery(text: string, apiKey: string, requestId?: string): Promise<number[]> {
    if (!apiKey) {
        throw new Error("API Key is required for embedding");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

    // Estimate: ~1 token per 4 chars
    const estimatedTokens = Math.ceil(text.length / 4);

    // 1. Check & Register against Rate Limits
    await TokenTracker.getInstance().checkAndRegister({
        requests: 1,
        tokens: estimatedTokens
    });

    console.log(`📡 [Gemini] Embedding Request: Length=${text.length} characters`);
    const result = await model.embedContent(text);

    // 2. Track Actual Usage (Embedding API doesn't always return usage, so we use our estimate or if result has it)
    TokenTracker.getInstance().trackUsage('Embedding', estimatedTokens, requestId);

    return result.embedding.values;
}

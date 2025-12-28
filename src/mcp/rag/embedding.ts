import { GoogleGenerativeAI } from "@google/generative-ai";

const EMBEDDING_MODEL = "text-embedding-004";

export async function embedQuery(
    text: string,
    apiKey: string
): Promise<number[]> {
    if (!apiKey) {
        throw new Error("API Key is required for embedding");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

    console.log(`📡 [Gemini] Embedding Request: Length=${text.length} characters`);
    const result = await model.embedContent(text);
    return result.embedding.values;
}

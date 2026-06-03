import { embed, embedMany } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { TokenTracker } from "../tokenTracker.js";

/**
 * Sanitizes text to prevent "Payload Poisoning" (malformed JSON errors)
 */
function sanitizeText(text: string): string {
    return text
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
        .replace(/[^\x00-\x7F]/g, " ")                // Replace non-ASCII with spaces for safety
        .trim();
}

export async function embedQuery(text: string, apiKey: string, providerOverride?: string, requestId?: string): Promise<number[]> {
    if (!apiKey) throw new Error("API Key is required");

    const google = createGoogleGenerativeAI({ apiKey });
    const cleanText = sanitizeText(text);

    try {
        const { embedding } = await embed({
            model: google.textEmbeddingModel('gemini-embedding-2'),
            value: cleanText
        });
        return embedding;
    } catch (e: any) {
        console.error("Embedding Query Failed:", e);
        throw e;
    }
}

export async function embedManyQueries(texts: string[], apiKey: string, providerOverride?: string, requestId?: string): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!apiKey) throw new Error("API Key is required");

    const google = createGoogleGenerativeAI({ apiKey });
    const sanitizedTexts = texts.map(sanitizeText).filter(t => t.length > 0);
    
    if (sanitizedTexts.length === 0) return [];

    try {
        const finalEmbeddings: number[][] = [];
        const batchSize = 100;
        
        for (let i = 0; i < sanitizedTexts.length; i += batchSize) {
            const batch = sanitizedTexts.slice(i, i + batchSize);
            const { embeddings } = await embedMany({
                model: google.textEmbeddingModel('gemini-embedding-2'),
                values: batch
            });
            finalEmbeddings.push(...embeddings);
        }

        // Token Tracking
        const totalChars = sanitizedTexts.reduce((acc, t) => acc + t.length, 0);
        const estTokens = Math.ceil(totalChars / 4);
        await TokenTracker.getInstance().checkAndRegister({ requests: 1, tokens: estTokens });
        TokenTracker.getInstance().trackUsage('Senior Batch Embedding', estTokens, requestId);

        return finalEmbeddings;
    } catch (e: any) {
        console.error("Batch Embedding Failed:", e);
        throw e;
    }
}

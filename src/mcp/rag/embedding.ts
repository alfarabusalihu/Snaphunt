import { embed } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createMistral } from '@ai-sdk/mistral';
import { TokenTracker } from "../tokenTracker.js";
import { getProviderByKey } from "../utils/provider.js";

// Embedding dimension reference:
// Google (text-embedding-004): 768
// OpenAI (text-embedding-3-small): 1536
// Mistral (mistral-embed): 1024

export async function embedQuery(text: string, apiKey: string, providerOverride?: string, requestId?: string): Promise<number[]> {
    if (!apiKey) {
        throw new Error("API Key is required for embedding");
    }

    const provider = providerOverride || getProviderByKey(apiKey);
    console.log(`📡 [Embedding] Provider: ${provider} (Override: ${providerOverride || 'none'}, Auto: ${getProviderByKey(apiKey) || 'none'})`);
    if (!provider) {
        throw new Error(`Invalid or unrecognized API key format. Please check your credentials.`);
    }

    let embeddingModel;
    if (provider === 'google') {
        const google = createGoogleGenerativeAI({ apiKey });
        embeddingModel = google.textEmbeddingModel('text-embedding-004');
    } else if (provider === 'mistral') {
        const mistral = createMistral({ apiKey });
        embeddingModel = mistral.textEmbeddingModel('mistral-embed');
    } else if (provider === 'openai') {
        const openai = createOpenAI({ apiKey });
        embeddingModel = openai.textEmbeddingModel('text-embedding-3-small');
    } else if (provider === 'anthropic') {
        // Anthropic doesn't have an embedding model yet, but if they add one or we want to error out:
        throw new Error("Anthropic does not support embedding currently. Please use Google, OpenAI, or Mistral for vector storage.");
    } else {
        throw new Error(`Provider for the given API key is not supported for embedding: ${provider}`);
    }

    const providerName = provider;

    // Estimate: ~1 token per 4 chars
    const estimatedTokens = Math.ceil(text.length / 4);

    // 1. Check & Register against Rate Limits
    await TokenTracker.getInstance().checkAndRegister({
        requests: 1,
        tokens: estimatedTokens
    });

    const isAmbiguous = providerName === 'openai' && apiKey.startsWith('sk-');
    console.log(`📡 [${isAmbiguous ? 'Auto-Detect' : providerName}] Embedding Request: Length=${text.length}`);

    try {
        const { embedding } = await embed({
            model: embeddingModel,
            value: text,
        });

        // 2. Track Actual Usage
        TokenTracker.getInstance().trackUsage('Embedding', estimatedTokens, requestId);

        return embedding;
    } catch (err: any) {
        console.error(`❌ Embedding failed with ${providerName}:`, err);
        throw err;
    }
}

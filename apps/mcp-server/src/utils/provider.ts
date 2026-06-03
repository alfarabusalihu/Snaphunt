
export type AIProvider = 'google';

/**
 * Identifies the AI provider based on the API key format.
 * Only Google API keys are supported.
 */
export function getProviderByKey(apiKey: string): AIProvider | null {
    if (!apiKey) return null;
    const key = apiKey.trim();

    if (key.startsWith('AIza')) return 'google';

    console.warn(`⚠️ Unsupported API key format. Only Google API keys (AIza...) are accepted.`);
    return null;
}

/**
 * Checks if a specific model is likely supported by the Google provider.
 */
export function isModelSupportedByProvider(provider: AIProvider, modelName: string): boolean {
    const model = modelName.toLowerCase();

    if (provider === 'google') {
        return model.includes('gemini') || model.includes('learnlm');
    }
    return false;
}

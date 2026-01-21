
export type AIProvider = 'google' | 'openai' | 'anthropic' | 'mistral';

/**
 * Identifies the AI provider based on the API key format.
 */
export function getProviderByKey(apiKey: string): AIProvider | null {
    if (!apiKey) return null;
    const key = apiKey.trim();

    if (key.startsWith('AIza')) return 'google';
    if (key.startsWith('sk-ant') || key.startsWith('sk-arr')) return 'anthropic';
    if (key.toLowerCase().startsWith('mistral')) return 'mistral';
    if (key.startsWith('sk-')) return 'openai';

    return null;
}

/**
 * Checks if a specific model is likely supported by a provider.
 */
export function isModelSupportedByProvider(provider: AIProvider, modelName: string): boolean {
    const model = modelName.toLowerCase();

    switch (provider) {
        case 'google':
            return model.includes('gemini') || model.includes('learnlm');
        case 'anthropic':
            return model.includes('claude');
        case 'mistral':
            return model.includes('mistral') || model.includes('mixtral');
        case 'openai':
            return model.includes('gpt-') || model.includes('o1-') || model.includes('o3-');
        default:
            return false;
    }
}

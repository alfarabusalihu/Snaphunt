import { sleep } from "../../utils.js";

type ProviderType = 'google' | 'openai' | 'anthropic' | 'mistral' | 'other';

class BurstGuard {
    private static instance: BurstGuard;
    private lastRequestTime: Record<string, number> = {};
    private minInterval = 250; // default 250ms gap

    private constructor() { }

    public static getInstance(): BurstGuard {
        if (!BurstGuard.instance) {
            BurstGuard.instance = new BurstGuard();
        }
        return BurstGuard.instance;
    }

    /**
     * Ensures that we wait at least minInterval since the last request for this provider.
     */
    public async wait(provider: ProviderType = 'other'): Promise<void> {
        const now = Date.now();
        const last = this.lastRequestTime[provider] || 0;
        const elapsed = now - last;

        if (elapsed < this.minInterval) {
            const delay = this.minInterval - elapsed;
            // Update lastRequestTime to the projected future time to "reserve" the slot
            this.lastRequestTime[provider] = now + delay;
            await sleep(delay);
        } else {
            this.lastRequestTime[provider] = now;
        }
    }
}

export const burstGuard = BurstGuard.getInstance();

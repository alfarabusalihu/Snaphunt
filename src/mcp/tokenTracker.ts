import * as fs from 'node:fs';
import * as path from 'node:path';

export class TokenTracker {
    private static instance: TokenTracker;

    // Rate Limiting State
    private tokensPerMinute = 0;
    private requestsPerMinute = 0;
    private lastResetTime = Date.now();
    private grandTotalTokens = 0;
    private globalCooldownUntil = 0;

    // Request Context State (for cumulative logging)
    private requestTotals: Map<string, number> = new Map();

    // Default Limits (Conservative defaults, tuned for free tiers)
    private readonly RPM_LIMIT = 5;
    private readonly TPM_LIMIT = 30000;
    private readonly persistencePath = path.resolve('data/token_usage.json');

    private constructor() {
        this.loadState();
    }

    public static getInstance(): TokenTracker {
        if (!TokenTracker.instance) {
            TokenTracker.instance = new TokenTracker();
        }
        return TokenTracker.instance;
    }

    /**
     * Checks if the proposed usage would exceed limits. 
     * If so, waits until limits reset.
     * Then registers the usage in the counters.
     */
    public async checkAndRegister(cost: { requests?: number, tokens?: number }): Promise<void> {
        const requests = cost.requests || 0;
        const tokens = cost.tokens || 0;

        // 1. Check Global Cooldown
        const now = Date.now();
        if (now < this.globalCooldownUntil) {
            const waitMs = this.globalCooldownUntil - now;
            console.warn(`⏳ [TokenTracker] Global Cooldown active. Waiting ${Math.ceil(waitMs / 1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, waitMs + 500));
        }

        this.resetCountersIfNeeded();

        if (this.requestsPerMinute + requests > this.RPM_LIMIT) {
            console.warn(`⏳ [TokenTracker] RPM Limit hit (${this.requestsPerMinute}/${this.RPM_LIMIT}). Waiting...`);
            await this.waitForReset();
            this.resetCountersIfNeeded();
        }

        if (this.tokensPerMinute + tokens > this.TPM_LIMIT) {
            console.warn(`⏳ [TokenTracker] TPM Limit hit (${this.tokensPerMinute}/${this.TPM_LIMIT}). Waiting...`);
            await this.waitForReset();
            this.resetCountersIfNeeded();
        }

        // Apply usage
        this.requestsPerMinute += requests;
        this.tokensPerMinute += tokens;
        this.saveState();
    }

    /**
     * Logs the actual token usage for a specific phase and request.
     * Updates the cumulative total for that request.
     */
    public trackUsage(phase: string, tokens: number, requestId?: string) {
        this.grandTotalTokens += tokens;

        const finalRequestId = requestId || "global";
        const current = this.requestTotals.get(finalRequestId) || 0;
        const newTotal = current + tokens;
        this.requestTotals.set(finalRequestId, newTotal);

        if (this.requestTotals.size > 1000) {
            this.requestTotals.clear();
        }

        console.log(`🧾 [TokenTracker] [${phase}] +${tokens} tokens | Request Total: ${newTotal} | Grand Total: ${this.grandTotalTokens}`);
        this.saveState();
    }

    /**
     * Call this when an external 429 is hit to sync the tracker cooldown.
     */
    public notifyExternalRateLimit(retrySeconds: number) {
        console.error(`🚨 [TokenTracker] External Rate Limit Hit! Cooling down for ${retrySeconds}s...`);
        this.globalCooldownUntil = Date.now() + (retrySeconds * 1000);
        this.saveState();
    }

    private loadState() {
        try {
            if (fs.existsSync(this.persistencePath)) {
                const data = JSON.parse(fs.readFileSync(this.persistencePath, 'utf8'));
                this.tokensPerMinute = data.tokensPerMinute || 0;
                this.requestsPerMinute = data.requestsPerMinute || 0;
                this.lastResetTime = data.lastResetTime || Date.now();
                this.globalCooldownUntil = data.globalCooldownUntil || 0;
                this.grandTotalTokens = data.grandTotalTokens || 0;
                console.log(`📦 [TokenTracker] Loaded persistent state (Grand Total: ${this.grandTotalTokens})`);
            }
        } catch (e) {
            console.warn("⚠️ [TokenTracker] Failed to load persistent state:", e);
        }
    }

    private saveState() {
        try {
            const data = {
                tokensPerMinute: this.tokensPerMinute,
                requestsPerMinute: this.requestsPerMinute,
                lastResetTime: this.lastResetTime,
                globalCooldownUntil: this.globalCooldownUntil,
                grandTotalTokens: this.grandTotalTokens
            };
            if (!fs.existsSync(path.dirname(this.persistencePath))) {
                fs.mkdirSync(path.dirname(this.persistencePath), { recursive: true });
            }
            fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.warn("⚠️ [TokenTracker] Failed to save persistent state:", e);
        }
    }

    private resetCountersIfNeeded() {
        const now = Date.now();
        if (now - this.lastResetTime >= 60000) {
            this.tokensPerMinute = 0;
            this.requestsPerMinute = 0;
            this.lastResetTime = now;
            this.saveState(); // Update reset time on disk
        }
    }

    private async waitForReset() {
        const now = Date.now();
        const timeToReset = 60000 - (now - this.lastResetTime) + 500; // +buffer
        if (timeToReset > 0) {
            await new Promise(resolve => setTimeout(resolve, timeToReset));
        }
    }
}

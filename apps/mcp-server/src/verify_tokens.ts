import { TokenTracker } from "./tokenTracker.js";

async function runTest() {
    console.log("🚀 Starting TokenTracker Verification...");

    const tracker = TokenTracker.getInstance();
    const requestId = "req-test-123";

    // 1. Simulate Embedding
    console.log("--- Phase 1: Embedding ---");
    await tracker.checkAndRegister({ requests: 1, tokens: 100 });
    tracker.trackUsage('Embedding', 100, requestId);

    // 2. Simulate Retrieval (Another embedding call usually)
    console.log("--- Phase 2: Retrieval ---");
    await tracker.checkAndRegister({ requests: 1, tokens: 20 });
    tracker.trackUsage('Embedding/Query', 20, requestId);

    // 3. Simulate Analysis
    console.log("--- Phase 3: Analysis ---");
    await tracker.checkAndRegister({ requests: 1, tokens: 500 }); // Input check
    // ... AI generates response ...
    tracker.trackUsage('Analysis', 1500, requestId);

    console.log("✅ Verification Complete. Check logs above for cumulative totals.");
}

runTest();

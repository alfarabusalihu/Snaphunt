import { parsePdf } from "./parser/parse.js";

async function main() {
    console.log("🧪 Testing Worker Integration...");
    try {
        // Send invalid data to trigger worker error handling
        await parsePdf(Buffer.from("not a pdf"));
        console.log("❌ Unexpected success (Should have failed parsing)");
    } catch (e: any) {
        if (e.message.includes('Invalid PDF structure') || e.message.includes('Worker stopped')) {
            console.log("✅ Worker communication successful. Received PDF error as expected.");
            console.log(`   Error: ${e.message}`);
        } else {
            console.log("⚠️ Worker returned unknown error:", e.message);
        }
    }
}

main().catch(console.error);

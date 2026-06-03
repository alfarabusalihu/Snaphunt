import cron from 'node-cron';
import { registry } from './database/index.js';
import { analyzeTalentPool } from './tools/analyzeCVs.js';
import { TokenTracker } from './tokenTracker.js';

export function initScheduler() {
    console.log('⏰ [Scheduler] Initializing background jobs...');

    // Weekly Re-scoring Job (Sundays at 2 AM)
    cron.schedule('0 2 * * 0', async () => {
        console.log('⏰ [Scheduler] Starting Weekly Analysis...');
        const allDocs = await registry.getAllDocuments();

        allDocs.forEach(doc => {
            if (!doc.is_indexed && Date.now() - new Date(doc.created_at).getTime() > 7 * 24 * 60 * 60 * 1000) {
                console.log(`🧹 [Scheduler] Cleaning up stale doc: ${doc.file_name}`);
                registry.deleteSource(doc.source_id);
            }
        });

        console.log('⏰ [Scheduler] Weekly job complete.');
    });
}

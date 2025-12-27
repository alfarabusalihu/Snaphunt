import { parseInput } from "../../parser/index.js";
import { ingestDocument } from "../../rag/injestion.js";
import { crawlBucket } from "../../parser/crawler.js";

export const ingestTool = {
    name: "crawl_and_ingest",
    description: "Crawl a source (LocalPath, URL, ZIP) and ingest candidates into the vector database.",
    run: async (args: { source: string; apiKey: string; chunkSize?: number; overlap?: number }) => {
        const { source, apiKey, chunkSize = 500, overlap = 50 } = args;

        let targets = source.startsWith('http') ? [source] : [source];
        if (source.startsWith('http')) {
            const crawled = await crawlBucket(source);
            if (crawled.length > 0) targets = crawled;
        }

        let successCount = 0;
        const details = [];

        for (const target of targets) {
            try {
                const parsedDocs = await parseInput(target);
                for (const doc of parsedDocs) {
                    await ingestDocument(doc.text, {
                        source: doc.metadata.fileName || target,
                        chunkSize,
                        overlap,
                        apiKey
                    });
                    successCount++;
                    details.push({ file: doc.metadata.fileName, status: 'success' });
                }
            } catch (e) {
                details.push({ file: target, status: 'error', error: String(e) });
            }
        }

        return {
            message: `Processed ${successCount} documents.`,
            details
        };
    }
};

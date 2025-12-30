import { chunkText } from "./chunk.js";
import { embedQuery } from "./embedding.js";
import { ensureCollection, storeVectors } from "./vector.js";
import type { IngestOptions, VectorPayload } from "./rag.types.js";
import { sleep } from "../../utils.js";
import { burstGuard } from "../utils/burstGuard.js";

export async function ingestDocument(rawText: string, options: IngestOptions): Promise<void> {
    const chunks = chunkText(rawText, {
        chunkSize: options.chunkSize,
        overlap: options.overlap,
    });

    if (chunks.length === 0) {
        throw new Error("No chunks produced from document");
    }

    console.log(`🧩 Processing ${chunks.length} chunks in parallel...`);

    const embeddings = await Promise.all(chunks.map(async (chunk) => {
        // Burst Guard - Wait if we're spamming
        await burstGuard.wait('google');

        return await embedQuery(chunk, options.apiKey, options.requestId);
    }));

    await ensureCollection(embeddings[0].length);
    const payloads: VectorPayload[] = chunks.map((chunk, index) => ({
        text: chunk,
        source: options.source,
        fileName: options.fileName,
        chunkIndex: index,
    }));

    await storeVectors(embeddings, payloads);
}

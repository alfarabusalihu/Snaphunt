import { chunkText } from "./chunk.js";
import { embedQuery } from "./embedding.js";
import { ensureCollection, storeVectors } from "./vector.js";
import { sleep } from "../../utils.js";
import type { IngestOptions, VectorPayload } from "./rag.types.js";

export async function ingestDocument(
    rawText: string,
    options: IngestOptions
): Promise<void> {
    const chunks = chunkText(rawText, {
        chunkSize: options.chunkSize,
        overlap: options.overlap,
    });

    if (chunks.length === 0) {
        throw new Error("No chunks produced from document");
    }

    const embeddings: number[][] = [];
    console.log(`🧩 Processing ${chunks.length} chunks...`);
    for (let i = 0; i < chunks.length; i++) {
        const emb = await embedQuery(chunks[i], options.apiKey);
        embeddings.push(emb);
        if (chunks.length > 5) await sleep(200); // Tiny pause to avoid burst limit
    }

    await ensureCollection(embeddings[0].length);

    const payloads: VectorPayload[] = chunks.map((chunk, index) => ({
        text: chunk,
        source: options.source,
        fileName: options.fileName,
        chunkIndex: index,
    }));

    await storeVectors(embeddings, payloads);
}

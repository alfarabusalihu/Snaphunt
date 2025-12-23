import { chunkText } from "./chunk.js";
import { embedQuery } from "./embedding.js";
import { ensureCollection, storeVectors } from "./vector.js";
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

  const embeddings = await Promise.all(
    chunks.map(chunk =>
      embedQuery(chunk, options.apiKey)
    )
  );

  await ensureCollection(embeddings[0].length);

  const payloads: VectorPayload[] = chunks.map((chunk, index) => ({
    text: chunk,
    source: options.source,
    chunkIndex: index,
  }));

  await storeVectors(embeddings, payloads);
}

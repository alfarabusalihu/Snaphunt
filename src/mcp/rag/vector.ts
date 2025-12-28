import { QdrantClient } from "@qdrant/js-client-rest";
import * as crypto from "node:crypto";
import { VectorPayload } from "./rag.types.js";

export const COLLECTION_NAME = "cv_embeddings";
export const qdrant = new QdrantClient({
    url: "http://localhost:6333"
});

export async function ensureCollection(
    embeddingSize: number
): Promise<void> {
    const collections = await qdrant.getCollections();

    const exists = collections.collections.some(
        (c) => c.name === COLLECTION_NAME
    );

    if (!exists) {
        await qdrant.createCollection(COLLECTION_NAME, {
            vectors: {
                size: embeddingSize,
                distance: "Cosine"
            }
        });
    }
}

export async function resetCollection(): Promise<void> {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
    if (exists) {
        await qdrant.deleteCollection(COLLECTION_NAME);
    }
}

export async function storeVectors(
    embeddings: number[][],
    payloads: VectorPayload[]
): Promise<void> {
    if (embeddings.length !== payloads.length) {
        throw new Error(
            "Embeddings count must match payloads count"
        );
    }

    await qdrant.upsert(COLLECTION_NAME, {
        points: embeddings.map((vector, index) => ({
            id: crypto.randomUUID(),
            vector,
            payload: payloads[index]
        }))
    });
}

export async function searchVectors(
    queryEmbedding: number[],
    limit = 5
): Promise<
    {
        score: number;
        payload: VectorPayload | null;
    }[]
> {
    const results = await qdrant.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        limit,
        with_payload: true
    });

    return results.map((item) => ({
        score: item.score,
        payload: item.payload as VectorPayload | null
    }));
}

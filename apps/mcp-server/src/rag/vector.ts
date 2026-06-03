import { QdrantClient } from "@qdrant/js-client-rest";
import * as crypto from "node:crypto";
import type { VectorPayload } from "./rag.types.js";

export const COLLECTION_NAME = "cv_embeddings";

// Lazy singleton — created on first use so env vars are guaranteed loaded
let _qdrant: QdrantClient | null = null;
let _connectionMode: 'cloud' | 'local' | null = null;

function getQdrant(): QdrantClient {
    if (_qdrant) return _qdrant;
    
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    const isCloudConfigured = url && apiKey && url.includes('.qdrant.io');
    
    if (isCloudConfigured) {
        try {
            console.log(`☁️  [Qdrant] Attempting cloud connection...`);
            const cleanUrl = url.replace(/\/$/, '').replace(/:\d+$/, ''); // Remove trailing slash and any port
            
            _qdrant = new QdrantClient({ 
                url: cleanUrl,
                apiKey, 
                checkCompatibility: false 
            });
            _connectionMode = 'cloud';
            console.log(`✅ [Qdrant] Cloud client initialized at ${cleanUrl}`);
        } catch (error) {
            console.warn(`⚠️  [Qdrant] Cloud initialization failed, falling back to local mode`);
            _qdrant = createLocalClient();
        }
    } else {
        console.log(`📍 [Qdrant] Using local mode (no cloud credentials provided)`);
        _qdrant = createLocalClient();
    }
    
    return _qdrant;
}

function createLocalClient(): QdrantClient {
    _connectionMode = 'local';
    return new QdrantClient({ url: "http://127.0.0.1:6333", checkCompatibility: false });
}

async function testConnection(): Promise<boolean> {
    try {
        await getQdrant().getCollections();
        return true;
    } catch (error) {
        return false;
    }
}

export async function ensureCollection(embeddingSize: number): Promise<void> {
    try {
        // Test connection first, fallback if cloud fails
        const isConnected = await testConnection();
        
        if (!isConnected && _connectionMode === 'cloud') {
            console.warn(`⚠️  [Qdrant] Cloud connection failed, switching to local fallback`);
            _qdrant = createLocalClient();
            
            // Verify local connection
            const localConnected = await testConnection();
            if (!localConnected) {
                throw new Error('Neither cloud nor local Qdrant is available. Please start a local Qdrant instance.');
            }
            console.log(`✅ [Qdrant] Fallback to local successful`);
        }

        const collections = await getQdrant().getCollections();
        const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);
        
        if (!exists) {
            console.log(`📦 [Qdrant] Creating collection '${COLLECTION_NAME}' with vector size ${embeddingSize}`);
            await getQdrant().createCollection(COLLECTION_NAME, {
                vectors: { size: embeddingSize, distance: "Cosine" }
            });
            console.log(`✅ [Qdrant] Collection '${COLLECTION_NAME}' created successfully`);
        } else {
            console.log(`✅ [Qdrant] Collection '${COLLECTION_NAME}' already exists`);
        }
    } catch (error: unknown) {
        console.error(`❌ [Qdrant] Failed to ensure collection:`, error);
        throw error;
    }
}

export async function resetCollection(): Promise<void> {
    const collections = await getQdrant().getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
    if (exists) await getQdrant().deleteCollection(COLLECTION_NAME);
}

export async function storeVectors(embeddings: number[][], payloads: VectorPayload[]): Promise<void> {
    if (embeddings.length !== payloads.length) {
        throw new Error("Embeddings count must match payloads count");
    }
    await getQdrant().upsert(COLLECTION_NAME, {
        points: embeddings.map((vector, index) => ({
            id: crypto.randomUUID(),
            vector,
            payload: payloads[index]
        }))
    });
}

export async function searchVectors(queryEmbedding: number[], limit = 5): Promise<{ score: number; payload: VectorPayload | null }[]> {
    try {
        const results = await getQdrant().search(COLLECTION_NAME, {
            vector: queryEmbedding,
            limit,
            with_payload: true
        });
        return results.map((item) => ({
            score: item.score,
            payload: item.payload as VectorPayload | null
        }));
    } catch (error: unknown) {
        const e = error as { status?: number; message?: string };
        if (e.status === 404 || e.message?.toLowerCase().includes('not found')) {
            console.warn(`⚠️ [Qdrant] Collection '${COLLECTION_NAME}' not found. Returning empty results.`);
            return [];
        }
        console.error("❌ [Qdrant] Search error:", error);
        throw error;
    }
}

export async function getLatestChunks(limit = 2): Promise<{ score: number; payload: VectorPayload | null }[]> {
    try {
        const response = await getQdrant().scroll(COLLECTION_NAME, {
            limit,
            with_payload: true,
            with_vector: false
        });
        return response.points.map((item) => ({
            score: 1.0,
            payload: item.payload as VectorPayload | null
        }));
    } catch (error: unknown) {
        const e = error as { status?: number; message?: string };
        if (e.status === 404 || e.message?.toLowerCase().includes('not found')) {
            return [];
        }
        throw error;
    }
}

export function getConnectionMode(): 'cloud' | 'local' | null {
    return _connectionMode;
}

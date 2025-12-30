export interface ChunkOptions {
    chunkSize?: number;
    overlap?: number;
}

export interface VectorPayload {
    [key: string]: unknown;
    text: string;
    source: string;
    fileName?: string;
    chunkIndex?: number;
}

export interface IngestOptions {
    source: string;
    fileName?: string;
    chunkSize?: number;
    overlap?: number;
    apiKey: string;
    requestId?: string;
}

export interface RetrievalResult {
    score: number;
    payload: VectorPayload | null;
}

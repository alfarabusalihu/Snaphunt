export interface Chunk {
  id: string,
  content: string,
  source: string,
  score: string
}

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

export interface getResult {
  chunks: Chunk[]
}

export interface VectorPayload {
  [key: string]: unknown;
  text: string;
  source: string;
  fileName?: string;
}

export interface IngestOptions {
  source: string;
  fileName?: string;
  chunkSize?: number;
  overlap?: number;
  apiKey: string;
}
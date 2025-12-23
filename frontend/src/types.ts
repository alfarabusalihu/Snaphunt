export interface Config {
    apiKey: string; // Gemini RAG Key
    model: string;
    analysisProvider: 'gemini' | 'openai';
    analysisApiKey?: string;
    analysisModel?: string;
    sourceType: "url" | "file";
    sourceValue: string;
    filterContext: string;
}

export interface Chunk {
    payload: {
        text: string;
        source: string;
        chunkIndex: number;
        fileName?: string;
    };
    score: number;
}

export interface PdfDocument {
    fileName: string;
    averageScore: number;
    chunkCount: number;
}

export interface QueryResponse {
    chunks: Chunk[];
    pdfs: PdfDocument[];
}

export interface AnalyzeResponse {
    analysis: string;
}

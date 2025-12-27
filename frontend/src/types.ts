export interface Config {
    apiKey: string;
    model: string;
    analysisProvider: 'gemini' | 'openai';
    analysisApiKey?: string;
    analysisModel?: string;
    sourceType: "url" | "file";
    sourceValue: string;
    filterContext: string;
    maxChunks?: number;
}
export interface PreviewFile {
    id: string;
    fileName: string;
    location: string;
    checksum: string;
    size?: number;
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

export interface AnalysisCandidate {
    source: string;
    score: number;
    suitable: boolean;
    justification: string;
}

export interface InternalCandidate {
    source: string;
    fileName: string;
    location: string;
    score: number;
    analysis?: AnalysisCandidate;
}

export interface AnalyzeResponse {
    analysis: {
        candidates: AnalysisCandidate[];
        summary: string;
    };
}

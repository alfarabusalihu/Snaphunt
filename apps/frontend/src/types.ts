export interface Config {
    apiKey: string;
    model: string;
    provider?: 'google';
    tier: 'basic' | 'pro';
    sourceType: "url" | "file";
    sourceValue: string;
    filterContext: string;
    keywords?: string[];
    maxChunks?: number;
}

export interface PreviewFile {
    id: string;
    fileName: string;
    location: string;
    checksum: string;
    size?: number;
    status?: 'indexed' | 'new' | 'duplicate';
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
    id?: string;
    source: string;
    fileName: string;
    location: string;
    score: number;
    analysis?: AnalysisCandidate;
}

export interface AnalysisResult {
    candidates: AnalysisCandidate[];
    summary: string;
}

export interface AnalyzeResponse {
    analysis: AnalysisResult;
}

export interface IngestStats {
    total: number;
    indexed: number;
    skipped: number;
    rejected: number;
}

/** A saved CV collection snapshot created after each ingest+query cycle. */
export interface CvCollection {
    id: string;
    name: string;
    createdAt: string; // ISO date string
    candidates: InternalCandidate[];
    keywords: string[];
    filterContext: string;
}

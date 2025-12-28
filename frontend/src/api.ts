import type { Config, QueryResponse, Chunk, AnalyzeResponse, PreviewFile } from './types';

const API_BASE = 'http://localhost:3400';

export const api = {
    async preview(sourceType: string, sourceValue: string) {
        const res = await fetch(`${API_BASE}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceType, sourceValue })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Preview failed');
        return data;
    },

    async ingest(config: Config, selectedFiles?: PreviewFile[]) {
        const res = await fetch(`${API_BASE}/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                files: selectedFiles || [],
                apiKey: config.apiKey
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ingestion failed');
        return data;
    },

    async query(query: string, apiKey: string, maxChunks?: number): Promise<QueryResponse> {
        const res = await fetch(`${API_BASE}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, apiKey, maxChunks })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Query failed');
        return data;
    },

    async analyze(
        chunks: Chunk[],
        apiKey: string,
        model: string,
        question: string,
        analysisProvider: string,
        analysisApiKey?: string,
        analysisModel?: string,
        maxChunks?: number
    ): Promise<AnalyzeResponse> {
        const res = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chunks,
                apiKey,
                model,
                question,
                analysisProvider,
                analysisApiKey,
                analysisModel,
                maxChunks
            })
        });
        const data = await res.json();
        if (!res.ok) {
            console.error('API Error details:', data);
            throw new Error(data.error || 'Analysis failed');
        }
        return data;
    },

    async listModels(provider: string, apiKey: string, signal?: AbortSignal) {
        const res = await fetch(`${API_BASE}/list-models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, apiKey }),
            signal
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to list models');
        }
        return res.json();
    },

    async getSources(): Promise<{ sources: any[] }> {
        const res = await fetch(`${API_BASE}/sources`);
        if (!res.ok) throw new Error('Failed to fetch past collections');
        return res.json();
    },

    async getSourceDocuments(sourceId: string): Promise<{ documents: any[] }> {
        const res = await fetch(`${API_BASE}/sources/${sourceId}/documents`);
        if (!res.ok) throw new Error('Failed to fetch documents for collection');
        return res.json();
    },

    async uploadFile(file: File): Promise<{ path: string, fileName: string }> {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
    },

    async reset() {
        const res = await fetch(`${API_BASE}/reset`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Reset failed');
        return data;
    }
};

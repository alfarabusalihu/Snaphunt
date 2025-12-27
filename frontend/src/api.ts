import type { Config, QueryResponse, Chunk, AnalyzeResponse, PreviewFile } from './types';

const API_BASE = 'http://localhost:3200';

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

    async listModels(provider: string, apiKey: string): Promise<{ models: string[] }> {
        const res = await fetch(`${API_BASE}/list-models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, apiKey })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to list models');
        return data;
    },

    async reset() {
        const res = await fetch(`${API_BASE}/reset`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Reset failed');
        return data;
    }
};

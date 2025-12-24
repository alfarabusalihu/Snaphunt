import type { Config, QueryResponse } from './types';

const API_BASE = 'http://localhost:3200';

export const api = {
    async preview(sourceType: string, sourceValue: string) {
        const res = await fetch(`${API_BASE}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceType, sourceValue })
        });
        if (!res.ok) throw new Error('Preview failed');
        return res.json();
    },

    async ingest(config: Config, selectedFiles?: any[]) {
        const res = await fetch(`${API_BASE}/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                files: selectedFiles || [],
                apiKey: config.apiKey
            })
        });
        if (!res.ok) throw new Error('Ingestion failed');
        return res.json();
    },

    async query(query: string, apiKey: string): Promise<QueryResponse> {
        const res = await fetch(`${API_BASE}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, apiKey })
        });
        if (!res.ok) throw new Error('Query failed');
        return res.json();
    },

    async analyze(
        chunks: any[],
        apiKey: string,
        model: string,
        question: string,
        analysisProvider: string,
        analysisApiKey: string,
        analysisModel: string
    ) {
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
                analysisModel
            })
        });
        if (!res.ok) throw new Error('Analysis failed');
        return res.json();
    },

    async reset() {
        const res = await fetch(`${API_BASE}/reset`, { method: 'POST' });
        if (!res.ok) throw new Error('Reset failed');
        return res.json();
    }
};

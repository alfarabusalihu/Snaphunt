import type { Config, QueryResponse, Chunk, AnalyzeResponse, PreviewFile } from './types';
import { useAppStore } from './store/useStore';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3400';

interface ApiResponse<T = unknown> {
    error?: string;
    [key: string]: T | string | undefined;
}

export interface SourceDocument {
    id: string;
    file_name: string;
    location: string;
    checksum: string;
}

const getAuthHeaders = (): Record<string, string> => {
    const { token, anonId } = useAppStore.getState();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (anonId) headers['X-Anon-Id'] = anonId;
    return headers;
};

async function handleResponse<T>(res: Response): Promise<T> {
    const data = await res.json() as ApiResponse;
    if (!res.ok) throw new Error((data.error as string) || `Request failed: ${res.status}`);
    return data as T;
}

export const api = {
    async register(email: string, password: string) {
        const anonId = useAppStore.getState().anonId;
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, anonId }),
        });
        return handleResponse<{ token: string; user: { id: string; email: string } }>(res);
    },

    async login(email: string, password: string) {
        const anonId = useAppStore.getState().anonId;
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, anonId }),
        });
        const data = await handleResponse<{ token: string; user: { id: string; email: string }; anon_id?: string }>(res);
        useAppStore.getState().setAuth(data.token, data.user);
        if (data.anon_id) useAppStore.getState().setAnonId(data.anon_id);
        return data;
    },

    async preview(sourceType: string, sourceValue: string) {
        const res = await fetch(`${API_BASE}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ sourceType, sourceValue }),
        });
        return handleResponse<{ files: PreviewFile[] }>(res);
    },

    async ingest(config: Config, selectedFiles?: PreviewFile[]) {
        const res = await fetch(`${API_BASE}/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                files: selectedFiles ?? [],
                apiKey: config.apiKey,
                provider: config.provider,
            }),
        });
        return handleResponse<{ stats: { total: number; indexed: number; skipped: number; rejected: number } }>(res);
    },

    async query(query: string, apiKey: string, maxChunks?: number, keywords?: string[]): Promise<QueryResponse> {
        const res = await fetch(`${API_BASE}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                apiKey,
                maxChunks,
                keywords,
                provider: useAppStore.getState().provider,
            }),
        });
        return handleResponse<QueryResponse>(res);
    },

    async analyze(
        chunks: Chunk[],
        apiKey: string,
        model: string,
        question: string,
        tier: 'basic' | 'pro',
        requestId?: string,
        maxChunks?: number,
        provider?: string,
        keywords?: string[]
    ): Promise<AnalyzeResponse> {
        const res = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chunks, apiKey, model, question, tier, requestId, maxChunks, provider, keywords }),
        });
        return handleResponse<AnalyzeResponse>(res);
    },

    async getSources(): Promise<{ sources: SourceDocument[] }> {
        const res = await fetch(`${API_BASE}/sources`, { headers: getAuthHeaders() });
        return handleResponse<{ sources: SourceDocument[] }>(res);
    },

    async getSourceDocuments(sourceId: string): Promise<{ documents: SourceDocument[] }> {
        const res = await fetch(`${API_BASE}/sources/${sourceId}/documents`, { headers: getAuthHeaders() });
        return handleResponse<{ documents: SourceDocument[] }>(res);
    },

    async uploadFile(file: File): Promise<{ path: string; fileName: string }> {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        return handleResponse<{ path: string; fileName: string }>(res);
    },

    async reset() {
        const res = await fetch(`${API_BASE}/reset`, { method: 'POST' });
        return handleResponse<{ message: string }>(res);
    },

    async deleteSource(sourceId: string) {
        const res = await fetch(`${API_BASE}/sources/${sourceId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ message: string }>(res);
    },

    async starDocument(location: string) {
        const res = await fetch(`${API_BASE}/star`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ location }),
        });
        return handleResponse<{ message: string }>(res);
    },

    async unstarDocument(location: string) {
        const res = await fetch(`${API_BASE}/star`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ location }),
        });
        return handleResponse<{ message: string }>(res);
    },

    async getStarredDocuments(): Promise<{ documents: SourceDocument[] }> {
        const res = await fetch(`${API_BASE}/starred`, { headers: getAuthHeaders() });
        return handleResponse<{ documents: SourceDocument[] }>(res);
    },

    async getStarredLocations(): Promise<{ locations: string[] }> {
        const res = await fetch(`${API_BASE}/starred/locations`, { headers: getAuthHeaders() });
        return handleResponse<{ locations: string[] }>(res);
    },
};

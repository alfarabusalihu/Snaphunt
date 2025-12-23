import axios from "axios";
import type { Config, QueryResponse, AnalyzeResponse, Chunk } from "./types";

const API_URL = "http://localhost:3200";

export const api = {
    reset: async () => {
        await axios.post(`${API_URL}/reset`);
    },

    ingest: async (config: Config) => {
        const payload: any = { apiKey: config.apiKey };
        if (config.sourceType === "url") {
            payload.url = config.sourceValue;
        } else {
            payload.filePath = config.sourceValue;
        }
        await axios.post(`${API_URL}/ingest`, payload);
    },

    query: async (query: string, apiKey: string): Promise<QueryResponse> => {
        const res = await axios.post(`${API_URL}/query`, { query, apiKey });
        return res.data;
    },

    analyze: async (chunks: Chunk[], apiKey: string, model: string, question?: string, analysisProvider?: string, analysisApiKey?: string, analysisModel?: string): Promise<AnalyzeResponse> => {
        const res = await axios.post(`${API_URL}/analyze`, {
            chunks,
            apiKey,
            model,
            question,
            analysisProvider,
            analysisApiKey,
            analysisModel
        });
        return res.data;
    }
};

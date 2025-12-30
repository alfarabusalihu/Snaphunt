import { embedQuery } from "./embedding.js";
import { searchVectors } from "./vector.js";

export async function retrieveRelevantChunks(query: string, apiKey: string, requestId?: string, topK = 5) {
    const queryEmbedding = await embedQuery(query, apiKey, requestId);
    const results = await searchVectors(queryEmbedding, topK);
    return results;
}

export async function queryDocuments(input: string, apiKey: string, options?: { topK?: number, requestId?: string }) {
    if (!input.trim()) throw new Error("Query cannot be empty");
    const queryEmbedding = await embedQuery(input, apiKey, options?.requestId);
    const chunkResults = await searchVectors(queryEmbedding, options?.topK ?? 30);

    const pdfMap: Record<string, any> = {};
    for (const r of chunkResults) {
        const source = r.payload!.source;
        if (!pdfMap[source]) pdfMap[source] = { source, score: 0, matchedChunks: 0 };
        pdfMap[source].score += r.score;
        pdfMap[source].matchedChunks += 1;
    }

    const pdfResults = Object.values(pdfMap).map(item => ({
        fileName: (item.source as string).split(/[\\\/]/).pop() || item.source,
        location: item.source,
        averageScore: item.score / item.matchedChunks,
        matchedChunks: item.matchedChunks,
        totalScore: item.score
    })).sort((a, b) => b.averageScore - a.averageScore);

    return { pdfs: pdfResults, chunks: chunkResults };
}

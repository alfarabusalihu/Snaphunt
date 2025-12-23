import { embedQuery } from "./rag/embedding.js";
import { searchVectors } from "./rag/vector.js";
import { rankPdfsFromChunks } from "./chunkToPdf.js";

export async function queryDocuments(
  input: string,
  apiKey: string,
  options?: { topK?: number }
) {
  if (!input.trim()) {
    throw new Error("Query cannot be empty");
  }

  const queryEmbedding = await embedQuery(input, apiKey);

  const chunkResults = await searchVectors(
    queryEmbedding,
    options?.topK ?? 30
  );

  const pdfResults = rankPdfsFromChunks(chunkResults);

  return {
    pdfs: pdfResults,
    chunks: chunkResults,
  };
}

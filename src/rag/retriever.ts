import { embedQuery } from "./embedding.js";
import { searchVectors } from "./vector.js";

export async function retrieveRelevantChunks(
  query: string,
  apiKey: string,
  topK = 5
) {
  const queryEmbedding = await embedQuery(query, apiKey);

  const results = await searchVectors(queryEmbedding, topK);

  return results;
}

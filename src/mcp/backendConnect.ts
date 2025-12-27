import { queryDocuments } from "../query.js";

export async function queryPdfs(query: string, apiKey: string, topK?: number) {
  const result = await queryDocuments(query, apiKey, { topK });
  return result;
}

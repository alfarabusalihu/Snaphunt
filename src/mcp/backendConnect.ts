import { queryDocuments } from "../query.js";

export async function queryPdfs(query: string, apiKey: string) {
  const result = await queryDocuments(query, apiKey);
  return result;
}

import { queryDocuments } from "../rag/retriever.js";

export const queryPdfsTool = {
  name: "query_pdfs",
  description: "Return PDFs and relevant chunks for a user query",
  run: async (args: { query: string; apiKey: string; topK?: number; requestId?: string }) => {
    return await queryDocuments(args.query, args.apiKey, { topK: args.topK, requestId: args.requestId });
  },
};

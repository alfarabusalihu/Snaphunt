import { queryPdfs } from "../backendConnect.js";

export const queryPdfsTool = {
  name: "query_pdfs",
  description: "Return PDFs and relevant chunks for a user query",
  run: async (args: { query: string; apiKey: string; topK?: number }) => {
    const result = await queryPdfs(args.query, args.apiKey, args.topK);
    return result;
  },
};

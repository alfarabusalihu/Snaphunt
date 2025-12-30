import { parseInput as internalParse } from "../parser/index.js";
import { ingestDocument as internalIngest } from "../rag/injestion.js";

export const ingestTool = {
    name: "ingest_cvs",
    description: "Parse and ingest CVs into vector database",
    run: async (args: { location: string; apiKey: string; chunkSize?: number; overlap?: number; requestId?: string }) => {
        const docs = await internalParse(args.location);
        for (const doc of docs) {
            await internalIngest(doc.text, {
                source: args.location,
                fileName: doc.metadata.fileName,
                chunkSize: args.chunkSize,
                overlap: args.overlap,
                apiKey: args.apiKey,
                requestId: args.requestId
            });
        }
        return { status: "success", count: docs.length };
    },
};

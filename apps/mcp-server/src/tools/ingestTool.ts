import { parseInput as internalParse } from "../parser/index.js";
import { ingestDocument as internalIngest } from "../rag/injestion.js";
import { registry } from '../database/index.js';
import * as crypto from "node:crypto";

export const ingestTool = {
    name: "ingest_cvs",
    description: "Parse and ingest CVs into vector database",
    run: async (args: { location: string; apiKey: string; chunkSize?: number; overlap?: number; requestId?: string }) => {
        const docs = await internalParse(args.location, args.apiKey);
        
        const sourceId = crypto.createHash('md5').update(args.location).digest('hex');
        try {
            await registry.createSource(sourceId, undefined, 'local_path', args.location);
        } catch (e) {
            // Source might already exist, which is fine
        }

        for (const doc of docs) {
            await internalIngest(doc.text, {
                source: args.location,
                fileName: doc.metadata.fileName,
                chunkSize: args.chunkSize,
                overlap: args.overlap,
                apiKey: args.apiKey,
                requestId: args.requestId
            });

            const checksum = crypto.createHash('md5').update(doc.text).digest('hex');
            try {
                await registry.createDocument({
                    id: crypto.randomUUID(),
                    source_id: sourceId,
                    file_name: doc.metadata.fileName ?? "unknown_file.pdf",
                    location: args.location,
                    checksum: checksum,
                    text_content: doc.text,
                    quality_score: 1.0
                });
            } catch (e) {
                // Document might already be created, which is fine
            }
        }
        return { status: "success", count: docs.length };
    },
};

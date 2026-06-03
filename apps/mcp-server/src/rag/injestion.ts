import { chunkText } from "./chunk.js";
import { embedManyQueries } from "./embedding.js";
import { ensureCollection, storeVectors } from "./vector.js";
import type { IngestOptions, VectorPayload } from "./rag.types.js";

export async function ingestDocument(rawText: string, options: IngestOptions): Promise<void> {
    let chunks: string[] = [];
    
    // Try to parse the rawText as Semantic JSON
    try {
        const parsed = JSON.parse(rawText);
        if (parsed.skills || parsed.experience || parsed.education) {
            console.log(`🧠 Detected structured Gemini JSON. Using Semantic Chunking for ${options.fileName}`);
            const skillsText = parsed.skills ? (Array.isArray(parsed.skills) ? parsed.skills.join(", ") : parsed.skills) : "None";
            const eduText = parsed.education ? (Array.isArray(parsed.education) ? parsed.education.join(" | ") : parsed.education) : "None";
            chunks.push(`Skills: ${skillsText}\nEducation: ${eduText}`);
            
            if (parsed.experience) {
                const expText = Array.isArray(parsed.experience) ? parsed.experience.join("\n") : parsed.experience;
                chunks.push(`Experience:\n${expText}`);
            }
        } else {
             throw new Error("Invalid Semantic Structure");
        }
    } catch (e) {
        console.log(`🔪 Falling back to blind slicing for ${options.fileName}`);
        chunks = chunkText(rawText, {
            chunkSize: options.chunkSize,
            overlap: options.overlap,
        });
    }

    if (chunks.length === 0) {
        throw new Error("No chunks produced from document");
    }

    console.log(`🧩 Processing ${chunks.length} chunks via batch embedding...`);

    const embeddings = await embedManyQueries(chunks, options.apiKey, options.provider, options.requestId);

    await ensureCollection(embeddings[0].length);
    const payloads: VectorPayload[] = chunks.map((chunk, index) => ({
        text: chunk,
        source: options.source,
        fileName: options.fileName,
        chunkIndex: index,
    }));

    await storeVectors(embeddings, payloads);
}

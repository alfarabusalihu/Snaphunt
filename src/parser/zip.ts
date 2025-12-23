import AdmZip from "adm-zip";
import crypto from "node:crypto";
import path from "node:path";
import { parsePdf } from "./parse.js";
import { ParsedDocument } from "./index.js";

export async function parseZip(buffer: Buffer, originalLocation: string): Promise<ParsedDocument[]> {
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    const results: ParsedDocument[] = [];

    for (const entry of zipEntries) {
        if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith(".pdf")) {
            try {
                const pdfBuffer = entry.getData();
                const text = await parsePdf(pdfBuffer);
                results.push({
                    id: crypto.randomUUID(),
                    text,
                    metadata: {
                        source: "local",
                        location: `${originalLocation}/${entry.entryName}`,
                        fileName: path.basename(entry.entryName)
                    }
                });
            } catch (error) {
                console.error(`Failed to parse PDF within ZIP (${entry.entryName}):`, error);
            }
        }
    }

    return results;
}

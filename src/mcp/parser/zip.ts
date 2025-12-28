import * as AdmZipPkg from "adm-zip";
const AdmZip = (AdmZipPkg as any).default || AdmZipPkg;
import * as crypto from "node:crypto";
import * as path from "node:path";
import { parsePdf } from "./parse.js";
import { ParsedDocument, calculateChecksum } from "./index.js";

export async function parseZip(
    buffer: Buffer,
    originalLocation: string
): Promise<ParsedDocument[]> {
    const zip = new AdmZip(buffer);
    const results: ParsedDocument[] = [];

    for (const entry of zip.getEntries()) {
        if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith(".pdf")) {
            const pdfBuffer = entry.getData();
            const text = await parsePdf(pdfBuffer);
            const checksum = calculateChecksum(pdfBuffer);

            results.push({
                id: crypto.randomUUID(),
                text,
                checksum,
                metadata: {
                    source: "local",
                    location: `${originalLocation}/${entry.entryName}`,
                    fileName: path.basename(entry.entryName),
                    size: pdfBuffer.length
                }
            });
        }
    }

    return results;
}

export function getZipEntryBuffer(zipPath: string, entryName: string): Buffer | null {
    try {
        const zip = new AdmZip(zipPath);
        return zip.getEntry(entryName)?.getData() || null;
    } catch (e) {
        return null;
    }
}

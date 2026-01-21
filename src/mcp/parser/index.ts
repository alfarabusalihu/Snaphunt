import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { parsePdf } from "./parse.js";
import { parseZip, getZipEntryBuffer } from "./zip.js";
import { crawlBucket } from "./crawler.js";
import * as fsSync from "node:fs";
import { registry } from "../../db.js";

export interface ParsedDocument {
    id: string;
    text: string;
    checksum: string;
    metadata: {
        source: "local" | "url";
        location: string;
        fileName?: string;
        size?: number;
    };
    quality?: {
        isValid: boolean;
        reason?: string;
        score: number;
    }
}

export { crawlBucket };

export function calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

import { performOCR } from "./ocr.js";
import { validateQuality } from "./validator.js";

export async function parseInput(filepathOrUrl: string): Promise<ParsedDocument[]> {
    const cleanPath = filepathOrUrl.replace(/^["'](.*)["']$/, '$1').trim();
    const isUrl = cleanPath.startsWith("http")

    let buffer: Buffer;
    let fileName: string | undefined;
    let location: string;
    let source: "url" | "local";

    if (isUrl) {
        buffer = await fetchFromUrl(cleanPath);
        fileName = path.basename(new URL(cleanPath).pathname);
        location = cleanPath;
        source = "url";
    } else {
        const resolvedPath = path.isAbsolute(cleanPath) ? cleanPath : path.resolve(cleanPath);
        // ZIP handling
        const zipMatch = resolvedPath.match(/(.*\.zip)[\\\/](.*)/i);
        if (zipMatch) {
            const [, zipPath, entryName] = zipMatch;
            const zipBuf = getZipEntryBuffer(zipPath, entryName);
            if (!zipBuf) throw new Error(`Could not extract ${entryName} from ${zipPath}`);
            buffer = zipBuf;
            fileName = path.basename(entryName);
            location = resolvedPath;
            source = "local";
        } else {
            // Normal file
            let stats;
            try { stats = await fs.stat(resolvedPath); } catch (e) { throw new Error(`File not found: ${resolvedPath}`); }
            if (stats.isDirectory()) return await parseDirectory(resolvedPath);

            buffer = await fs.readFile(resolvedPath);
            // Recursive zip check
            if (resolvedPath.toLowerCase().endsWith(".zip")) return await parseZip(buffer, resolvedPath);

            fileName = path.basename(resolvedPath);
            location = resolvedPath;
            source = "local";
        }
    }

    // 1. Primary Parse
    let text = await parsePdf(buffer);

    // 2. OCR Fallback: If text is suspiciously short but file is large enough to be an image
    if (text.trim().length < 50 && buffer.length > 5000) {
        console.log(`📷 [OCR] Triggering OCR for ${fileName} (Text len: ${text.length}, Size: ${buffer.length})`);
        try {
            const ocrText = await performOCR(buffer);
            if (ocrText.length > text.length) {
                text = ocrText;
                console.log(`✅ [OCR] Success. Extracted ${text.length} chars.`);
            }
        } catch (e) {
            console.error(`❌ [OCR] Failed:`, e);
        }
    }

    // 3. Validation Guard
    const quality = validateQuality(text);
    if (!quality.isValid) {
        console.warn(`⚠️ [Validation] Discarding ${fileName}: ${quality.reason}`);
        // In a real flow we might throw or return a "rejected" status. 
        // For now, we return empty text which ensures it won't be indexed meaningfully, 
        // or we can attach metadata for the DB to see.
    }

    const checksum = calculateChecksum(buffer);

    return [{
        id: crypto.randomUUID(),
        text,
        checksum,
        metadata: {
            source,
            location,
            fileName,
            size: buffer.length
        },
        quality // Pass this through to be stored if possible, or just used by caller
    } as any]; // Casting as any to allow quality field temporarily
}

async function parseDirectory(dirPath: string): Promise<ParsedDocument[]> {
    const results: ParsedDocument[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            const subResults = await parseDirectory(fullPath);
            results.push(...subResults);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
            try {
                const buffer = await fs.readFile(fullPath);
                const text = await parsePdf(buffer);
                const checksum = calculateChecksum(buffer);
                results.push({
                    id: crypto.randomUUID(),
                    text,
                    checksum,
                    metadata: {
                        source: "local",
                        location: fullPath,
                        fileName: entry.name,
                        size: buffer.length
                    }
                });
            } catch (error) {
                console.error(`Failed to parse ${fullPath}:`, error);
            }
        }
    }

    return results;
}

export async function scanInput(filepathOrUrl: string): Promise<any[]> {
    const cleanPath = filepathOrUrl.replace(/^["'](.*)["']$/, '$1').trim();
    console.log(`📂 Scanning input: ${cleanPath}`);
    const isUrl = cleanPath.startsWith("http");

    if (isUrl) {
        const fileName = path.basename(new URL(cleanPath).pathname) || "document.pdf";
        return [{
            id: crypto.randomUUID(),
            fileName,
            location: cleanPath,
            checksum: 'pending',
            size: 0
        }];
    }

    const resolvedPath = path.isAbsolute(cleanPath) ? cleanPath : path.resolve(cleanPath);
    let stats;
    try {
        stats = await fs.stat(resolvedPath);
    } catch (e) {
        console.warn(`Stat failed for ${resolvedPath}`);
        return [];
    }

    if (stats.isDirectory()) {
        console.log(`📁 Target is a directory: ${filepathOrUrl}`);
        return await scanDirectory(filepathOrUrl);
    }

    if (resolvedPath.toLowerCase().endsWith(".zip")) {
        console.log(`📦 Target is a ZIP file: ${resolvedPath}`);
        console.log(`📦 [ZIP] Extracting PDFs from archive, this may take a moment...`);
        try {
            const AdmZip = (await import("adm-zip")).default;
            const zip = new AdmZip(resolvedPath);
            const entries = zip.getEntries();
            const pdfs = entries
                .filter(e => !e.isDirectory && e.entryName.toLowerCase().endsWith(".pdf"))
                .map(e => ({
                    id: crypto.randomUUID(),
                    fileName: path.basename(e.entryName),
                    location: `${resolvedPath}/${e.entryName}`, // Virtual path for unzipping later
                    checksum: `zip-${e.entryName}-${e.header.size}`,
                    size: e.header.size
                }));
            console.log(`✅ Found ${pdfs.length} PDFs in ZIP.`);
            return pdfs;
        } catch (err) {
            console.error("Failed to read ZIP:", err);
            return [];
        }
    }

    const parentDir = path.dirname(filepathOrUrl);
    console.log(`📄 Target is a file. Expanding discovery to siblings in: ${parentDir}`);
    const siblings = await scanDirectory(parentDir);

    const targetName = path.basename(filepathOrUrl);
    return siblings.sort((a, b) => (a.fileName === targetName ? -1 : b.fileName === targetName ? 1 : 0));
}

async function scanDirectory(dirPath: string): Promise<any[]> {
    const results: any[] = [];
    console.log(`📂 Entering directory: ${dirPath}`);

    let entries;
    try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (err) {
        console.error(`❌ Failed to read directory ${dirPath}:`, err);
        return [];
    }

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.name.startsWith('.')) continue;

        if (entry.isDirectory()) {
            const subResults = await scanDirectory(fullPath);
            results.push(...subResults);
        } else if (entry.isFile()) {
            const isPdf = entry.name.toLowerCase().endsWith('.pdf');
            if (isPdf) {
                try {
                    const stats = await fs.stat(fullPath);
                    console.log(`✅ Found PDF: ${entry.name} (${(stats.size / 1024).toFixed(1)} KB)`);

                    results.push({
                        id: crypto.randomUUID(),
                        fileName: entry.name,
                        location: fullPath,
                        checksum: `preview-${stats.size}-${stats.mtimeMs}`,
                        size: stats.size
                    });
                } catch (err) {
                    console.error(`⚠️ Failed to stat file ${entry.name}:`, err);
                }
            }
        }
    }

    console.log(`✅ Scan directory complete. Found ${results.length} PDFs in ${dirPath}`);
    return results;
}

async function fetchFromUrl(url: string): Promise<Buffer> {
    const res = await fetch(url)
    if (!res.ok) {
        throw new Error(`failed to fetch pdfs from ${url}`)
    }
    return Buffer.from(await res.arrayBuffer())
}

export async function getFileBuffer(location: string): Promise<{ buffer: Buffer, fileName: string } | null> {
    const cleanPath = location.replace(/^["'](.*)["']$/, '$1').trim();
    if (cleanPath.startsWith("http")) {
        const buffer = await fetchFromUrl(cleanPath);
        const fileName = path.basename(new URL(cleanPath).pathname) || "document.pdf";
        return { buffer, fileName };
    }

    // Handle ZIP virtual paths (both forward and back slashes)
    const zipMatch = cleanPath.match(/(.*\.zip)[\\\/](.*)/i);
    if (zipMatch) {
        const [, zipPath, entryName] = zipMatch;
        const resolvedZipPath = path.isAbsolute(zipPath) ? zipPath : path.resolve(zipPath);
        const buffer = getZipEntryBuffer(resolvedZipPath, entryName);
        if (buffer) {
            console.log(`📦 Retrieved from ZIP: ${entryName}`);
            return { buffer, fileName: path.basename(entryName) };
        }
        console.warn(`⚠️ Failed to extract ${entryName} from ${resolvedZipPath}`);
    }

    const absolutePath = path.isAbsolute(cleanPath) ? cleanPath : path.resolve(cleanPath);
    if (fsSync.existsSync(absolutePath)) {
        const buffer = await fs.readFile(absolutePath);
        return { buffer, fileName: path.basename(absolutePath) };
    }

    const allDocs = registry.getAllDocuments();
    const matchedDoc = allDocs.find(d => d.file_name === cleanPath || d.file_name === path.basename(cleanPath));
    if (matchedDoc && fsSync.existsSync(matchedDoc.location)) {
        const buffer = await fs.readFile(matchedDoc.location);
        return { buffer, fileName: matchedDoc.file_name };
    }

    return null;
}

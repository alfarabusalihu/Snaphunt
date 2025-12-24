import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { parsePdf } from "./parse.js";
import { parseZip, getZipEntryBuffer } from "./zip.js";
import fsSync from "node:fs";

export interface ParsedDocument {
  id: string;
  text: string;
  checksum: string;
  metadata: {
    source: "local" | "url";
    location: string;
    fileName?: string;
    size?: number;
  }
}

export function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function parseInput(filepathOrUrl: string): Promise<ParsedDocument[]> {
  const isUrl = filepathOrUrl.startsWith("http")

  if (isUrl) {
    const buffer = await fetchFromUrl(filepathOrUrl);
    const text = await parsePdf(buffer);
    const checksum = calculateChecksum(buffer);
    const fileName = path.basename(new URL(filepathOrUrl).pathname);
    return [{
      id: crypto.randomUUID(),
      text,
      checksum,
      metadata: {
        source: "url",
        location: filepathOrUrl,
        fileName: fileName || undefined,
        size: buffer.length
      }
    }];
  }

  const stats = await fs.stat(filepathOrUrl);

  if (stats.isDirectory()) {
    return await parseDirectory(filepathOrUrl);
  }

  const buffer = await fs.readFile(filepathOrUrl);
  const checksum = calculateChecksum(buffer);

  if (filepathOrUrl.toLowerCase().endsWith(".zip")) {
    return await parseZip(buffer, filepathOrUrl);
  }

  const text = await parsePdf(buffer);
  return [{
    id: crypto.randomUUID(),
    text,
    checksum,
    metadata: {
      source: "local",
      location: filepathOrUrl,
      fileName: path.basename(filepathOrUrl),
      size: buffer.length
    }
  }];
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

async function fetchFromUrl(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`failed to fetch pdfs from ${url}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

export async function getFileBuffer(location: string): Promise<{ buffer: Buffer, fileName: string } | null> {
  if (location.startsWith("http")) {
    const buffer = await fetchFromUrl(location);
    const fileName = path.basename(new URL(location).pathname) || "document.pdf";
    return { buffer, fileName };
  }

  const zipMatch = location.match(/(.*\.zip)\/(.*)/i);
  if (zipMatch) {
    const [, zipPath, entryName] = zipMatch;
    const buffer = getZipEntryBuffer(path.resolve(zipPath), entryName);
    if (buffer) return { buffer, fileName: path.basename(entryName) };
  }

  const absolutePath = path.resolve(location);
  if (fsSync.existsSync(absolutePath)) {
    const buffer = await fs.readFile(absolutePath);
    return { buffer, fileName: path.basename(location) };
  }

  return null;
}


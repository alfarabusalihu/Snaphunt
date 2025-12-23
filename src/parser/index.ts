import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { parsePdf } from "./parse.js";
import { parseZip } from "./zip.js";

export interface ParsedDocument {
  id: string;
  text: string;
  metadata: {
    source: "local" | "url";
    location: string;
    fileName?: string;
  }
}

export async function parseInput(filepathOrUrl: string): Promise<ParsedDocument[]> {
  const isUrl = filepathOrUrl.startsWith("http")

  if (isUrl) {
    const buffer = await fetchFromUrl(filepathOrUrl);
    const text = await parsePdf(buffer);
    const fileName = path.basename(new URL(filepathOrUrl).pathname);
    return [{
      id: crypto.randomUUID(),
      text,
      metadata: {
        source: "url",
        location: filepathOrUrl,
        fileName: fileName || undefined
      }
    }];
  }

  const stats = await fs.stat(filepathOrUrl);

  if (stats.isDirectory()) {
    return await parseDirectory(filepathOrUrl);
  }

  const buffer = await fs.readFile(filepathOrUrl);

  if (filepathOrUrl.toLowerCase().endsWith(".zip")) {
    return await parseZip(buffer, filepathOrUrl);
  }

  const text = await parsePdf(buffer);
  return [{
    id: crypto.randomUUID(),
    text,
    metadata: {
      source: "local",
      location: filepathOrUrl,
      fileName: path.basename(filepathOrUrl)
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
        results.push({
          id: crypto.randomUUID(),
          text,
          metadata: {
            source: "local",
            location: fullPath,
            fileName: entry.name
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


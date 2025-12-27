import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { parsePdf } from "./parse.js";
import { parseZip, getZipEntryBuffer } from "./zip.js";
import fsSync from "node:fs";
import { registry } from "../db.js";

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
  const cleanPath = filepathOrUrl.replace(/^["'](.*)["']$/, '$1').trim();
  const isUrl = cleanPath.startsWith("http")

  if (isUrl) {
    const buffer = await fetchFromUrl(cleanPath);
    const text = await parsePdf(buffer);
    const checksum = calculateChecksum(buffer);
    const fileName = path.basename(new URL(cleanPath).pathname);
    return [{
      id: crypto.randomUUID(),
      text,
      checksum,
      metadata: {
        source: "url",
        location: cleanPath,
        fileName: fileName || undefined,
        size: buffer.length
      }
    }];
  }

  const resolvedPath = path.isAbsolute(cleanPath) ? cleanPath : path.resolve(cleanPath);
  const stats = await fs.stat(resolvedPath);

  if (stats.isDirectory()) {
    return await parseDirectory(resolvedPath);
  }

  const buffer = await fs.readFile(resolvedPath);
  const checksum = calculateChecksum(buffer);

  if (resolvedPath.toLowerCase().endsWith(".zip")) {
    return await parseZip(buffer, resolvedPath);
  }

  const text = await parsePdf(buffer);
  return [{
    id: crypto.randomUUID(),
    text,
    checksum,
    metadata: {
      source: "local",
      location: resolvedPath,
      fileName: path.basename(resolvedPath),
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
  const stats = await fs.stat(resolvedPath);
  if (stats.isDirectory()) {
    console.log(`📁 Target is a directory: ${filepathOrUrl}`);
    return await scanDirectory(filepathOrUrl);
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

  const zipMatch = cleanPath.match(/(.*\.zip)\/(.*)/i);
  if (zipMatch) {
    const [, zipPath, entryName] = zipMatch;
    const buffer = getZipEntryBuffer(path.resolve(zipPath), entryName);
    if (buffer) return { buffer, fileName: path.basename(entryName) };
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

import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import * as bodyParserPkg from "body-parser";
const bodyParser = (bodyParserPkg as any).default || bodyParserPkg;
import { queryPdfsTool } from "./tools/queryTool.js";
import { analyzeTalentPool } from "./tools/analyzeCVs.js";
import { parseInput, scanInput, crawlBucket } from "./parser/index.js";
import { ingestDocument } from "./rag/injestion.js";
import { resetCollection, getLatestChunks } from "./rag/vector.js";
import { registry } from "../db.js";
import * as crypto from "node:crypto";

const app = express();
app.use((bodyParser as any).json());
const PORT = process.env.MCP_PORT || 3300;

app.post("/preview", async (req: Request, res: Response) => {
  try {
    const { sourceType, sourceValue: rawSource } = req.body;
    const sourceValue = rawSource?.replace(/^["'](.*)["']$/, '$1').trim();
    let targets = [sourceValue];
    if (sourceType === 'url') {
      const crawled = await crawlBucket(sourceValue);
      if (crawled.length > 0) targets = crawled;
    }
    const files = [];
    const sourceId = crypto.createHash('md5').update(sourceValue).digest('hex');

    // 1. Ensure Source exists in registry
    registry.createSource(sourceId, sourceType, sourceValue);

    for (const target of targets) {
      try {
        const scannedDocs = await scanInput(target);
        for (const doc of scannedDocs) {
          // 2. Check if document already exists by checksum
          let existing = registry.getDocByChecksum(doc.checksum);
          if (!existing) {
            registry.createDocument({
              id: doc.id,
              source_id: sourceId,
              file_name: doc.fileName,
              location: doc.location,
              checksum: doc.checksum,
              text_content: ""
            });
            existing = doc;
          }
          files.push({
            id: existing.id,
            fileName: (existing as any).file_name || (existing as any).fileName,
            location: existing.location,
            checksum: existing.checksum,
            size: (existing as any).size || 0
          });
        }
      } catch (e) {
        console.error(`Preview failed for ${target}:`, e);
      }
    }
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/ingest", async (req: Request, res: Response) => {
  try {
    const { files, apiKey, chunkSize = 500, overlap = 50, requestId } = req.body;
    let successCount = 0;
    for (const file of files) {
      try {
        const parsedDocs = await parseInput(file.location);
        const doc = parsedDocs[0];
        if (doc) {
          await ingestDocument(doc.text, { source: file.location, fileName: doc.metadata.fileName || file.fileName, chunkSize, overlap, apiKey, requestId });

          // 3. Update Registry with text content and mark as indexed
          const existing = registry.getDocByChecksum(file.checksum);
          if (existing) {
            registry.createDocument({
              ...existing,
              text_content: doc.text
            });
            registry.markAsIndexed(existing.id);
          }

          successCount++;
        }
      } catch (e) {
        console.error(`Failed to ingest ${file.location}:`, e);
      }
    }
    res.json({ message: `Ingestion complete. Processed ${successCount}/${files.length} files.` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/query", async (req: Request, res: Response) => {
  try {
    const { query, apiKey, maxChunks, requestId } = req.body;
    const result = await queryPdfsTool.run({ query, apiKey, topK: maxChunks, requestId });
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { chunks, apiKey, model, question, tier = 'basic', maxChunks = 5, requestId } = req.body;

    if (!chunks || chunks.length === 0) {
      return res.status(400).json({ error: "No chunks provided for analysis." });
    }

    const analysis = await analyzeTalentPool(chunks, question, apiKey, model, undefined, tier as any, requestId);
    res.json({ analysis });
  } catch (err: any) {
    console.error("❌ Analysis failed in MCP:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.post("/reset", async (req: Request, res: Response) => {
  try {
    await resetCollection();
    registry.resetIndexStatus();
    res.json({ message: "Vector collection reset successfully (Configurations cleared)." });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.delete("/sources/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    registry.deleteSource(id);
    res.json({ message: "Collection removed from history." });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const server = app.listen(PORT, () => {
  console.log(`MCP server running on http://localhost:${PORT}`);
});

server.on('error', (err: any) => {
  console.error("❌ [MCP] Server instance error:", err);
});

setInterval(() => { }, 60000);

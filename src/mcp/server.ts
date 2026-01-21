import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import * as bodyParserPkg from "body-parser";
const bodyParser = (bodyParserPkg as any).default || bodyParserPkg;
import { queryPdfsTool } from "./tools/queryTool.js";
import { analyzeTalentPool } from "./tools/analyzeCVs.js";
import { getProviderByKey } from "./utils/provider.js";
import { parseInput, scanInput, crawlBucket } from "./parser/index.js";
import { ingestDocument } from "./rag/injestion.js";
import { resetCollection, getLatestChunks } from "./rag/vector.js";
import { TokenTracker } from "./tokenTracker.js";
import { registry } from "../db.js";
import * as crypto from "node:crypto";
import { limitConcurrency } from "./utils/concurrency.js";

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
    console.log(`💾 [Registry] Created/Updated source: ${sourceId} (${sourceType}: ${sourceValue})`);

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
    const { files, apiKey, provider, chunkSize = 500, overlap = 50, requestId } = req.body;
    console.log(`📥 [Server] Ingest Request: Provider=${provider}, KeyPrefix=${apiKey?.substring(0, 5)}..., Files=${files?.length}`);
    let successCount = 0;
    const limit = limitConcurrency(20);
    const tasks = files.map((file: any) => limit(async () => {
      try {
        const parsedDocs = await parseInput(file.location);
        const doc = parsedDocs[0];

        if (doc) {
          // 3. Validation Check
          if (doc.quality && !doc.quality.isValid) {
            console.warn(`⛔ [Ingest] Rejected ${doc.metadata.fileName}: ${doc.quality.reason}`);
            const existing = registry.getDocByChecksum(file.checksum);
            if (existing) {
              registry.markAsRejected(existing.id, doc.quality.reason || 'Unknown quality issue');
            }
            return;
          }

          await ingestDocument(doc.text, { source: file.location, fileName: doc.metadata.fileName || file.fileName, chunkSize, overlap, apiKey, provider, requestId });

          // 4. Update Registry with text content and mark as indexed
          const existing = registry.getDocByChecksum(file.checksum);
          if (existing) {
            registry.createDocument({
              ...existing,
              text_content: doc.text,
              quality_score: doc.quality?.score,
              quality_reason: doc.quality?.reason
            });
            registry.markAsIndexed(existing.id);
          }

          successCount++;
        }
      } catch (e) {
        console.error(`Failed to ingest ${file.location}:`, e);
      }
    }));

    await Promise.all(tasks);
    res.json({ message: `Ingestion complete. Processed ${successCount}/${files.length} files.` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/query", async (req: Request, res: Response) => {
  try {
    const { query, apiKey, provider, maxChunks, requestId } = req.body;
    const result = await queryPdfsTool.run({ query, apiKey, provider, topK: maxChunks, requestId });
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { chunks, apiKey, provider, model, question, tier = 'basic', maxChunks = 5, requestId } = req.body;
    console.log(`📡 [Server] /analyze request received.`);
    console.log(`   - Provider: ${provider}`);
    console.log(`   - Model: ${model}`);
    console.log(`   - Key Prefix: ${apiKey?.substring(0, 5)}...`);
    console.log(`   - Chunks: ${chunks?.length}`);
    console.log(`   - Available Keys in body: ${Object.keys(req.body).join(', ')}`);

    if (!chunks || chunks.length === 0) {
      return res.status(400).json({ error: "No chunks provided for analysis." });
    }

    const analysis = await analyzeTalentPool(chunks, question, apiKey, model, tier as any, requestId, maxChunks, provider);
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
    TokenTracker.getInstance().resetGrandTotal(); // Clear token accumulation
    res.json({ message: "Vector collection reset successfully (Configurations cleared)." });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/sources", async (req: Request, res: Response) => {
  try { res.json({ sources: registry.getSources() }); }
  catch (err) { res.status(500).json({ error: "Failed to fetch sources" }); }
});

app.get("/sources/:id/documents", async (req: Request, res: Response) => {
  try { res.json({ documents: registry.getDocsBySource(req.params.id) }); }
  catch (err) { res.status(500).json({ error: "Failed to fetch documents" }); }
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

app.post("/list-models", async (req: Request, res: Response) => {
  // Manual model listing is retired in favor of smart provider detection.
  // This endpoint is kept for possible future use or internal debugging.
  res.json({ models: [], message: "Model listing is handled automatically by provider detection." });
});

import { initScheduler } from "./scheduler.js";

const server = app.listen(PORT, () => {
  console.log(`MCP server running on http://localhost:${PORT}`);
  initScheduler();
});

server.on('error', (err: any) => {
  console.error("❌ [MCP] Server instance error:", err);
});

setInterval(() => { }, 60000);

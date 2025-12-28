import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import * as bodyParserPkg from "body-parser";
const bodyParser = (bodyParserPkg as any).default || bodyParserPkg;
import { queryPdfsTool } from "./tools/queryTool.js";
import { analyzeTalentPool } from "./tools/analyzeCVs.js";
import { parseInput, scanInput, crawlBucket } from "./parser/index.js";
import { ingestDocument } from "./rag/injestion.js";
import { resetCollection } from "./rag/vector.js";

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
    for (const target of targets) {
      try {
        const scannedDocs = await scanInput(target);
        for (const doc of scannedDocs) {
          files.push({ id: doc.id, fileName: doc.fileName, location: doc.location, checksum: doc.checksum, size: doc.size });
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
    const { files, apiKey, chunkSize = 500, overlap = 50 } = req.body;
    let successCount = 0;
    for (const file of files) {
      try {
        const parsedDocs = await parseInput(file.location);
        const doc = parsedDocs[0];
        if (doc) {
          await ingestDocument(doc.text, { source: file.location, fileName: doc.metadata.fileName || file.fileName, chunkSize, overlap, apiKey });
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
    const { query, apiKey, maxChunks } = req.body;
    const result = await queryPdfsTool.run({ query, apiKey, topK: maxChunks });
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { chunks, apiKey, model, analysisProvider = 'gemini', analysisApiKey, analysisModel, question, maxChunks = 5 } = req.body;
    const effectiveApiKey = analysisProvider === 'gemini' ? (analysisApiKey || apiKey) : analysisApiKey;
    const effectiveModel = analysisModel || model || (analysisProvider === 'gemini' ? "gemini-1.5-flash" : "gpt-4o-mini");
    const analysis = await analyzeTalentPool(chunks, question, effectiveApiKey, effectiveModel, analysisProvider as any, maxChunks);
    res.json({ analysis });
  } catch (err: any) {
    console.error("❌ Analysis failed in MCP:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.post("/reset", async (req: Request, res: Response) => {
  try {
    await resetCollection();
    res.json({ message: "Vector collection reset successfully." });
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

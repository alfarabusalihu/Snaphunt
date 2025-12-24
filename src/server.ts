import dotenv from "dotenv";
dotenv.config();
import express from "express";
import bodyParser from "body-parser";

import { ingestDocument } from "./rag/injestion.js";
import { parseInput, getFileBuffer } from "./parser/index.js";
import { crawlBucket } from "./parser/crawler.js";
import { queryDocuments } from "./query.js";
import { resetCollection } from "./rag/vector.js";
import { answerQuestion, analyzeTalentPool } from "./mcp/tools/analyzeCVs.js";
import { registry } from "./db.js";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";


const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(bodyParser.json());

// app.get("/", (req, res) => {
//   res.send(`Backend server running on ${PORT}`);
// });

app.post("/preview", async (req, res) => {
  try {
    const { sourceType, sourceValue } = req.body;
    if (!sourceValue) return res.status(400).json({ error: "sourceValue is required" });

    let targets = sourceType === 'file' ? [sourceValue] : [sourceValue];

    if (sourceType === 'url') {
      const crawled = await crawlBucket(sourceValue);
      if (crawled.length > 0) targets = crawled;
    }

    const files: any[] = [];
    for (const target of targets) {
      try {
        const parsedDocs = await parseInput(target);
        for (const doc of parsedDocs) {
          files.push({
            id: doc.id,
            fileName: doc.metadata.fileName,
            location: doc.metadata.location,
            checksum: doc.checksum,
            size: doc.metadata.size
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

app.post("/ingest", async (req, res) => {
  try {
    const { files, apiKey, chunkSize = 500, overlap = 50 } = req.body;

    if (!apiKey) return res.status(400).json({ error: "apiKey is required" });
    if (!files || !Array.isArray(files)) return res.status(400).json({ error: "files list is required" });

    let successCount = 0;
    for (const file of files) {
      try {
        const parsedDocs = await parseInput(file.location);
        const doc = parsedDocs.find(d => d.checksum === file.checksum);
        if (doc) {
          await ingestDocument(doc.text, {
            source: doc.metadata.fileName || file.location,
            chunkSize,
            overlap,
            apiKey
          });
          successCount++;
        }
      } catch (e) {
        console.error(`Failed to ingest ${file.location}:`, e);
      }
    }
    return res.json({ message: `Ingestion complete. Processed ${successCount}/${files.length} files.` });
  } catch (err) {
    if (err instanceof Error) res.status(500).json({ error: err.message });
    else res.status(500).json({ error: String(err) });
  }
});

app.post("/query", async (req, res) => {
  try {
    const { query, apiKey } = req.body;

    if (!query) return res.status(400).json({ error: "Query is required" });
    if (!apiKey) return res.status(400).json({ error: "apiKey is required" });

    const result = await queryDocuments(query, apiKey);

    res.json(result);
  } catch (err) {
    if (err instanceof Error) res.status(500).json({ error: err.message });
    else res.status(500).json({ error: String(err) });
  }
});

app.post("/reset", async (req, res) => {
  try {
    await resetCollection();
    res.json({ message: "Vector collection reset successfully." });
  } catch (err) {
    if (err instanceof Error) res.status(500).json({ error: err.message });
    else res.status(500).json({ error: String(err) });
  }
});


app.post("/analyze", async (req, res) => {
  try {
    const { chunks, apiKey, model, analysisProvider = 'gemini', analysisApiKey, analysisModel, question } = req.body;

    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({ error: "No chunks provided for analysis." });
    }

    const effectiveApiKey = analysisProvider === 'gemini' ? (analysisApiKey || apiKey) : analysisApiKey;
    const effectiveModel = analysisModel || model || (analysisProvider === 'gemini' ? "gemini-1.5-flash" : "gpt-4o-mini");

    if (!effectiveApiKey) {
      return res.status(400).json({ error: `${analysisProvider} API key is required for analysis.` });
    }

    console.log(`🧠 Delegating analysis to MCP Tool [${analysisProvider}]`);

    const analysis = await analyzeTalentPool(
      chunks,
      question,
      effectiveApiKey,
      effectiveModel,
      analysisProvider as any
    );

    res.json({ analysis });

  } catch (err) {
    if (err instanceof Error) res.status(500).json({ error: err.message });
    else res.status(500).json({ error: String(err) });
  }
});

app.get("/file", async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') return res.status(400).send("Path is required");

    const result = await getFileBuffer(filePath);
    if (!result) return res.status(404).send("File not found");

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
    res.send(result.buffer);
  } catch (err) {
    res.status(500).send("Failed to serve file");
  }
});

app.get("/download", async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') return res.status(400).send("Path is required");

    const result = await getFileBuffer(filePath);
    if (!result) return res.status(404).send("File not found");

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.buffer);
  } catch (err) {
    res.status(500).send("Failed to download file");
  }
});


app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

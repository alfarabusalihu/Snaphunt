import dotenv from "dotenv";
dotenv.config();
import express from "express";
import bodyParser from "body-parser";

import { ingestDocument } from "./rag/injestion.js";
import { parseInput } from "./parser/index.js";
import { crawlBucket } from "./parser/crawler.js";
import { queryDocuments } from "./query.js";
import { resetCollection } from "./rag/vector.js";
import { answerQuestion } from "./mcp/tools/analyzeCVs.js";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import AdmZip from "adm-zip";


const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Backend server running");
});

app.post("/ingest", async (req, res) => {
  try {
    const { rawText, source, filePath, url, chunkSize = 500, overlap = 50, apiKey } = req.body;

    if (!apiKey) return res.status(400).json({ error: "apiKey is required" });

    if (filePath || url) {
      let targets = filePath ? [filePath] : (url ? [url] : []);

      if (url) {
        const crawled = await crawlBucket(url);
        if (crawled.length > 0) {
          console.log(`Crawled found ${crawled.length} files from ${url}`);
          targets = crawled;
        }
      }

      let successCount = 0;
      for (const target of targets) {
        try {
          const parsedDocs = await parseInput(target);
          for (const doc of parsedDocs) {
            await ingestDocument(doc.text, {
              source: doc.metadata.fileName || source || target,
              chunkSize,
              overlap,
              apiKey
            });
          }
          successCount++;
        } catch (e) {
          console.error(`Failed to ingest ${target}:`, e);
        }
      }
      return res.json({ message: `Ingestion complete. Processed ${successCount}/${targets.length} targets.` });
    }

    if (!rawText || !source) {
      return res.status(400).json({ error: "Provide (rawText and source) OR (filePath/url)" });
    }

    await ingestDocument(rawText, { source, chunkSize, overlap, apiKey });

    res.json({ message: `Document ${source} ingested successfully.` });
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

    const contextText = chunks
      .sort((a, b) => b.score - a.score)
      .map(c => `[${c.payload.source} - chunk ${c.payload.chunkIndex}]\n${c.payload.text}`)
      .join("\n\n");

    const uniqueSources = new Set(chunks.map(c => c.payload.source));
    console.log(`🔍 [${analysisProvider}] Analyzing context from ${chunks.length} chunks across ${uniqueSources.size} unique sources.`);

    const prompt = question
      ? `${question}\n\nContext:\n${contextText}`
      : `Analyze the following CVs and summarize key information:\n\n${contextText}`;

    const analysis = await answerQuestion(prompt, contextText, effectiveApiKey, effectiveModel, analysisProvider);
    res.json({ analysis });

  } catch (err) {
    if (err instanceof Error) res.status(500).json({ error: err.message });
    else res.status(500).json({ error: String(err) });
  }
});

app.get("/file", async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).send("Path is required");
    }

    if (filePath.startsWith("http")) {
      console.log(`🔗 Redirecting to external URL: ${filePath}`);
      return res.redirect(filePath);
    }

    const zipMatch = filePath.match(/(.*\.zip)\/(.*)/i);
    if (zipMatch) {
      const [, zipPath, entryName] = zipMatch;
      const normalizedZipPath = path.resolve(zipPath);

      if (fs.existsSync(normalizedZipPath)) {
        console.log(`📦 Extracting entry "${entryName}" from ZIP: ${normalizedZipPath}`);
        const zip = new AdmZip(normalizedZipPath);
        const entry = zip.getEntry(entryName);

        if (entry) {
          const buffer = entry.getData();
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${path.basename(entryName)}"`);
          return res.send(buffer);
        }
      }
    }

    const absolutePath = path.resolve(filePath);
    console.log(`📂 Serving local file: ${absolutePath}`);

    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ File not found: ${absolutePath}`);
      return res.status(404).send("File not found");
    }

    res.sendFile(absolutePath, (err) => {
      if (err) {
        console.error(`❌ Error sending file ${absolutePath}:`, err);
        if (!res.headersSent) {
          res.status(500).send("Error sending file");
        }
      }
    });
  } catch (err) {
    console.error("❌ Unexpected error in /file endpoint:", err);
    res.status(500).send("Failed to serve file");
  }
});


app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

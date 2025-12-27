import dotenv from "dotenv";
dotenv.config();
import express from "express";
import bodyParser from "body-parser";
import { getFileBuffer } from "./parser/index.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { OpenAI } from "openai";
import cors from "cors";

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(bodyParser.json());

const MCP_URL = `http://localhost:${process.env.MCP_PORT || 3300}`;

app.post("/preview", async (req, res) => {
  try {
    const response = await fetch(`${MCP_URL}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "MCP Server unreachable" });
  }
});

app.post("/ingest", async (req, res) => {
  try {
    const response = await fetch(`${MCP_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "MCP Server unreachable" });
  }
});

app.post("/query", async (req, res) => {
  try {
    const response = await fetch(`${MCP_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "MCP Server unreachable" });
  }
});

app.post("/reset", async (req, res) => {
  try {
    const response = await fetch(`${MCP_URL}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "MCP Server unreachable" });
  }
});

app.post("/analyze", async (req, res) => {
  try {
    const response = await fetch(`${MCP_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "MCP Server unreachable" });
  }
});

app.post("/list-models", async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: "API Key is required" });

    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey });
      const response = await openai.models.list();
      const models = response.data
        .filter(m => m.id.startsWith('gpt-'))
        .map(m => m.id);
      return res.json({ models });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    const data = await response.json() as any;
    if (data.error) throw new Error(data.error.message || "Failed to fetch Gemini models");

    const apiModels = (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => m.name.replace('models/', ''));

    const essentialModels = [
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-pro'
    ];
    const models = Array.from(new Set([...essentialModels, ...apiModels])).sort();

    res.json({ models });
  } catch (err: any) {
    console.error("❌ Failed to list models:", err);
    res.status(500).json({ error: String(err) });
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

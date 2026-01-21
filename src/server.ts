import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import * as bodyParserPkg from "body-parser";
const bodyParser = (bodyParserPkg as any).default || bodyParserPkg;
import { getFileBuffer } from "./mcp/parser/index.js";
import cors from "cors";
import * as multerPkg from "multer";
const multer = (multerPkg as any).default || multerPkg;
import * as path from "path";
import * as fs from "fs";

const upload = multer({ dest: 'temp_uploads/' });
const app = express();
app.use(cors());
app.use((bodyParser as any).json());

const PORT = process.env.PORT || 3400;
const MCP_URL = `http://localhost:${process.env.MCP_PORT || 3300}`;

app.post("/preview", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${MCP_URL}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) });
    res.status(response.status).json(await response.json());
  } catch (err) { res.status(500).json({ error: "MCP Server unreachable" }); }
});

app.post("/ingest", async (req: Request, res: Response) => {
  try {
    const bodyWithId = { ...req.body, requestId: `ingest-${Date.now()}` };
    const response = await fetch(`${MCP_URL}/ingest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyWithId) });
    res.status(response.status).json(await response.json());
  } catch (err) { res.status(500).json({ error: "MCP Server unreachable" }); }
});

app.post("/query", async (req: Request, res: Response) => {
  try {
    // Pass requestId to MCP
    const bodyWithId = { ...req.body, requestId: `req-${Date.now()}` };
    const response = await fetch(`${MCP_URL}/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyWithId) });
    res.status(response.status).json(await response.json());
  } catch (err) { res.status(500).json({ error: "MCP Server unreachable" }); }
});

app.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { apiKey, model, tier, question, chunks } = req.body;
    const bodyWithId = {
      apiKey,
      model,
      tier,
      question,
      chunks,
      requestId: `req-${Date.now()}`
    };
    const response = await fetch(`${MCP_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyWithId)
    });
    res.status(response.status).json(await response.json());
  } catch (err) { res.status(500).json({ error: "MCP Server unreachable" }); }
});

app.post("/reset", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${MCP_URL}/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) });
    res.status(response.status).json(await response.json());
  } catch (err) { res.status(500).json({ error: "MCP Server unreachable" }); }
});

app.post("/list-models", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${MCP_URL}/list-models`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) });
    res.status(response.status).json(await response.json());
  } catch (err) { res.status(500).json({ error: "MCP Server unreachable" }); }
});

app.get("/sources", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${MCP_URL}/sources`);
    res.status(response.status).json(await response.json());
  } catch (err) { res.status(500).json({ error: "MCP Server unreachable" }); }
});

app.get("/sources/:id/documents", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${MCP_URL}/sources/${req.params.id}/documents`);
    res.status(response.status).json(await response.json());
  } catch (err) { res.status(500).json({ error: "MCP Server unreachable" }); }
});

app.delete("/sources/:id", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${MCP_URL}/sources/${req.params.id}`, { method: 'DELETE' });
    res.status(response.status).json(await response.json());
  } catch (err) { res.status(500).json({ error: "MCP Server unreachable" }); }
});

app.post("/upload", upload.single('file'), (req: any, res: any) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const targetPath = path.join('temp_uploads', req.file.originalname);
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    fs.renameSync(req.file.path, targetPath);
    res.json({ path: path.resolve(targetPath), fileName: req.file.originalname });
  } catch (err) { res.status(500).json({ error: "Upload failed" }); }
});

app.get("/file", async (req: Request, res: Response) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') return res.status(400).send("Path required");
    const result = await getFileBuffer(filePath);
    if (!result) return res.status(404).send("Not found");
    res.setHeader('Content-Type', 'application/pdf');
    res.send(result.buffer);
  } catch (err) { res.status(500).send("Failed"); }
});

const server = app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));
server.on('error', err => console.error("❌ [Backend] Error:", err));
setInterval(() => { }, 6000);

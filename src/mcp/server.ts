import dotenv from "dotenv";
dotenv.config();
import express from "express";
import bodyParser from "body-parser";
import { queryPdfsTool } from "./tools/queryTool.js";
import { analyzeChunksTool } from "./tools/analyzeTool.js";


const app = express();
app.use(bodyParser.json());
const PORT = process.env.MCP_PORT;

app.post("/query_pdfs", async (req, res) => {
  try {
    const { query, apiKey } = req.body;
    const result = await queryPdfsTool.run({ query, apiKey });
    res.json(result);
  } catch (err: unknown) {
    if (err instanceof Error) res.status(500).json({ error: err.message });
    else res.status(500).json({ error: String(err) });
  }
});

app.post("/analyze_chunks", async (req, res) => {
  try {
    const { chunks, apiKey, model, question } = req.body;
    const result = await analyzeChunksTool.run({ chunks, apiKey, model, question });
    res.json({ analysis: result });
  } catch (err: unknown) {
    if (err instanceof Error) res.status(500).json({ error: err.message });
    else res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`MCP server running on http://localhost:${PORT}`);
});

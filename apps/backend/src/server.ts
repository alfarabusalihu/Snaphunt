import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

const upload = multer({ dest: 'temp_uploads/' });
const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 3400;
const MCP_URL = `http://127.0.0.1:${process.env.MCP_PORT ?? 3300}`;

// ── Header forwarding ─────────────────────────────────────────────────────────
const getHeaders = (req: Request): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    if (req.headers['x-anon-id']) headers['x-anon-id'] = req.headers['x-anon-id'] as string;
    return headers;
};

// ── Proxy helper ───────────────────────────────────────────────────────────────
async function proxy(url: string, init: RequestInit, res: Response): Promise<void> {
    try {
        const response = await fetch(url, init);
        res.status(response.status).json(await response.json());
    } catch {
        res.status(500).json({ error: 'MCP Server unreachable' });
    }
}

// ── Auth ───────────────────────────────────────────────────────────────────────
app.post('/auth/register', (req, res) => proxy(`${MCP_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) }, res));
app.post('/auth/login',    (req, res) => proxy(`${MCP_URL}/auth/login`,    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) }, res));
app.get('/auth/me',        (req, res) => proxy(`${MCP_URL}/auth/me`,       { method: 'GET',  headers: getHeaders(req) }, res));

// ── Pipeline ───────────────────────────────────────────────────────────────────
app.post('/preview', (req, res) => proxy(`${MCP_URL}/preview`, { method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) }, res));
app.post('/ingest',  (req, res) => proxy(`${MCP_URL}/ingest`,  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...req.body, requestId: `ingest-${Date.now()}` }) }, res));
app.post('/query',   (req, res) => proxy(`${MCP_URL}/query`,   { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...req.body, requestId: `req-${Date.now()}` }) }, res));
app.post('/reset',   (req, res) => proxy(`${MCP_URL}/reset`,   { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) }, res));

app.post('/analyze', (req, res) => {
    const { apiKey, model, tier, question, chunks, keywords, provider } = req.body as Record<string, unknown>;
    proxy(`${MCP_URL}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, model, tier, question, chunks, keywords, provider, requestId: `req-${Date.now()}` }) }, res);
});

// ── Sources & Stars ────────────────────────────────────────────────────────────
app.get('/sources',               (req, res) => proxy(`${MCP_URL}/sources`,                            { headers: getHeaders(req) }, res));
app.get('/sources/:id/documents', (req, res) => proxy(`${MCP_URL}/sources/${req.params.id}/documents`, { headers: getHeaders(req) }, res));
app.delete('/sources/:id',        (req, res) => proxy(`${MCP_URL}/sources/${req.params.id}`,           { method: 'DELETE', headers: getHeaders(req) }, res));
app.post('/star',                 (req, res) => proxy(`${MCP_URL}/star`,    { method: 'POST',   headers: getHeaders(req), body: JSON.stringify(req.body) }, res));
app.delete('/star',               (req, res) => proxy(`${MCP_URL}/star`,    { method: 'DELETE', headers: getHeaders(req), body: JSON.stringify(req.body) }, res));
app.get('/starred',               (req, res) => proxy(`${MCP_URL}/starred`, { headers: getHeaders(req) }, res));
app.get('/starred/locations',     (req, res) => proxy(`${MCP_URL}/starred/locations`, { headers: getHeaders(req) }, res));

// ── File upload ────────────────────────────────────────────────────────────────
app.post('/upload', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    const targetPath = path.join('temp_uploads', req.file.originalname);
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    fs.renameSync(req.file.path, targetPath);
    res.json({ path: path.resolve(targetPath), fileName: req.file.originalname });
});

// ── File serve ─────────────────────────────────────────────────────────────────
app.get('/file', async (req: Request, res: Response) => {
    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') { res.status(400).send('Path required'); return; }
    const { getFileBuffer } = await import('./parser-bridge.js');
    const result = await getFileBuffer(filePath);
    if (!result) { res.status(404).send('Not found'); return; }
    res.setHeader('Content-Type', 'application/pdf');
    res.send(result.buffer);
});

// ── File download ──────────────────────────────────────────────────────────────
app.get('/download', async (req: Request, res: Response) => {
    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') { res.status(400).send('Path required'); return; }
    const { getFileBuffer } = await import('./parser-bridge.js');
    const result = await getFileBuffer(filePath);
    if (!result) { res.status(404).send('Not found'); return; }
    const safeName = path.basename(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(result.buffer);
});

// ── Frontend static (production) ───────────────────────────────────────────────
const distPath = path.join(path.resolve(), '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    const apiPrefixes = ['/auth', '/star', '/starred', '/sources', '/preview', '/ingest', '/query', '/analyze', '/reset', '/upload', '/file'];
    app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.method !== 'GET' || apiPrefixes.some(p => req.path.startsWith(p))) return next();
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 [Backend] Running on http://localhost:${PORT}`));

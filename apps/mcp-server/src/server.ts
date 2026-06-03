import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Load root .env regardless of working directory
const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });
import express, { Request, Response, NextFunction } from 'express';
import * as bodyParserPkg from 'body-parser';
const bodyParser = (bodyParserPkg as unknown as { default: typeof bodyParserPkg }).default ?? bodyParserPkg;
import { queryPdfsTool } from './tools/queryTool.js';
import { analyzeTalentPool } from './tools/analyzeCVs.js';
import { parseInput, scanInput, crawlBucket } from './parser/index.js';
import { ingestDocument } from './rag/injestion.js';
import { resetCollection } from './rag/vector.js';
import { TokenTracker } from './tokenTracker.js';
import { connectDB, registry } from './database/index.js';
import * as crypto from 'node:crypto';
import { limitConcurrency } from './utils/concurrency.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initScheduler } from './scheduler.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'snaphunt-super-secret-key-change-me';
if (JWT_SECRET === 'snaphunt-super-secret-key-change-me' && process.env.NODE_ENV === 'production') {
    console.warn("⚠️ [MCP] WARNING: Using fallback JWT_SECRET in production! Please configure a secure JWT_SECRET in your environment.");
}

// ── Auth middleware ────────────────────────────────────────────────────────────
type AuthedRequest = Request & { user: { userId: string; email: string } };

const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
        return;
    }
    try {
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as { userId: string; email: string };
        (req as AuthedRequest).user = decoded;
        next();
    } catch {
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        try {
            const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as { userId: string; email: string };
            (req as AuthedRequest).user = decoded;
            return next();
        } catch { /* fall through to anon */ }
    }
    const anonId = req.headers['x-anon-id'];
    if (anonId && typeof anonId === 'string') {
        (req as AuthedRequest).user = { userId: anonId, email: 'anon@local' };
    }
    next();
};

const app = express();
app.use(express.json());
const PORT = process.env.MCP_PORT ?? 3300;

// ── Auth ───────────────────────────────────────────────────────────────────────
app.post('/auth/register', async (req: Request, res: Response) => {
    try {
        const { email, password, anonId } = req.body as { email: string; password: string; anonId?: string };
        if (!email || !password) { res.status(400).json({ error: 'Email and password are required' }); return; }
        const existing = await registry.getUserByEmail(email);
        if (existing) { res.status(400).json({ error: 'User already exists with this email' }); return; }
        const id = crypto.randomUUID();
        await registry.createUser(id, email, await bcrypt.hash(password, 10));
        if (anonId) await registry.migrateAnonData(anonId, id);
        res.json({ token: jwt.sign({ userId: id, email }, JWT_SECRET, { expiresIn: '7d' }), user: { id, email } });
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/auth/login', async (req: Request, res: Response) => {
    try {
        const { email, password, anonId } = req.body as { email: string; password: string; anonId?: string };
        if (!email || !password) { res.status(400).json({ error: 'Email and password are required' }); return; }
        const user = await registry.getUserByEmail(email);
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            res.status(400).json({ error: 'Invalid email or password' }); return;
        }
        if (anonId) await registry.migrateAnonData(anonId, user._id);
        res.json({ token: jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' }), user: { id: user._id, email: user.email } });
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/auth/me', authenticate, async (req: Request, res: Response) => {
    try {
        const user = await registry.getUserById((req as AuthedRequest).user.userId);
        if (!user) { res.status(404).json({ error: 'User not found' }); return; }
        res.json({ user: { id: user._id, email: user.email } });
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Preview ────────────────────────────────────────────────────────────────────
app.post('/preview', optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const { sourceType, sourceValue: rawSource } = req.body as { sourceType: string; sourceValue: string };
        const sourceValue = rawSource?.replace(/^["'](.*)["']$/, '$1').trim();
        let targets = [sourceValue];
        if (sourceType === 'url') {
            const crawled = await crawlBucket(sourceValue);
            if (crawled.length > 0) targets = crawled;
        }
        const sourceId = crypto.createHash('md5').update(sourceValue).digest('hex');
        await registry.createSource(sourceId, (req as AuthedRequest).user?.userId, sourceType, sourceValue);

        const files = [];
        for (const target of targets) {
            try {
                const scannedDocs = await scanInput(target);
                for (const doc of scannedDocs) {
                    let existing: any = await registry.getDocByChecksum(doc.checksum);
                    if (!existing) {
                        await registry.createDocument({ id: doc.id, source_id: sourceId, file_name: doc.fileName, location: doc.location, checksum: doc.checksum, text_content: '' });
                        existing = doc;
                    }
                    files.push({ id: doc.id, registryId: existing._id ?? existing.id, fileName: existing.fileName ?? existing.file_name ?? doc.fileName, location: doc.location, checksum: doc.checksum, size: doc.size ?? 0 });
                }
            } catch (e) { console.error(`Preview failed for ${target}:`, e); }
        }
        res.json({ files });
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Ingest ─────────────────────────────────────────────────────────────────────
app.post('/ingest', async (req: Request, res: Response) => {
    try {
        const { files, apiKey, provider, chunkSize = 500, overlap = 50, requestId } = req.body as {
            files: Array<{ checksum: string; fileName: string; location: string }>;
            apiKey: string; provider: string; chunkSize?: number; overlap?: number; requestId?: string;
        };
        let successCount = 0, skippedCount = 0, rejectedCount = 0;
        const limit = limitConcurrency(10);

        await Promise.all(files.map(file => limit(async () => {
            try {
                const existing: any = await registry.getDocByChecksum(file.checksum);
                if (existing) {
                    if (existing.isIndexed === 1) { skippedCount++; successCount++; return; }
                    if (existing.isIndexed === -1) { rejectedCount++; return; }
                }
                const parsedDocs = await parseInput(file.location);
                const doc = parsedDocs[0];
                if (!doc) return;

                if (doc.quality && !doc.quality.isValid) {
                    rejectedCount++;
                    const ex: any = await registry.getDocByChecksum(file.checksum);
                    if (ex) await registry.markAsRejected(ex._id, doc.quality.reason ?? 'Unknown quality issue');
                    return;
                }

                await ingestDocument(doc.text, { source: file.location, fileName: doc.metadata.fileName ?? file.fileName, chunkSize, overlap, apiKey, provider, requestId });

                const ex: any = await registry.getDocByChecksum(file.checksum);
                if (ex) {
                    await registry.createDocument({
                        id: ex._id,
                        source_id: ex.source_id,
                        file_name: ex.fileName,
                        location: ex.location,
                        checksum: ex.checksum,
                        text_content: doc.text,
                        quality_score: doc.quality?.score,
                        quality_reason: doc.quality?.reason
                    });
                    await registry.markAsIndexed(ex._id);
                }
                successCount++;
            } catch (e) { console.error(`Failed to ingest ${file.location}:`, e); }
        })));

        res.json({ message: 'Ingestion complete.', stats: { total: files.length, indexed: successCount - skippedCount, skipped: skippedCount, rejected: rejectedCount } });
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Query & Analyze ────────────────────────────────────────────────────────────
app.post('/query', async (req: Request, res: Response) => {
    try {
        const { query, apiKey, provider, maxChunks, requestId, keywords } = req.body;
        res.json(await queryPdfsTool.run({ query, apiKey, provider, topK: maxChunks, requestId, keywords }));
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/analyze', async (req: Request, res: Response) => {
    try {
        const { chunks, apiKey, provider, model, question, tier = 'basic', maxChunks = 5, requestId, keywords } = req.body;
        if (!chunks?.length) { res.status(400).json({ error: 'No chunks provided for analysis.' }); return; }
        const analysis = await analyzeTalentPool(chunks, question, apiKey, model, tier, requestId, maxChunks, provider, keywords);
        res.json({ analysis });
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Reset ──────────────────────────────────────────────────────────────────────
app.post('/reset', async (_req: Request, res: Response) => {
    try {
        await resetCollection();
        await registry.resetIndexStatus();
        TokenTracker.getInstance().resetGrandTotal();
        res.json({ message: 'Vector collection reset successfully.' });
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Sources ────────────────────────────────────────────────────────────────────
app.get('/sources', authenticate, async (req: Request, res: Response) => {
    try { res.json({ sources: await registry.getSources((req as AuthedRequest).user.userId) }); }
    catch (err) { res.status(500).json({ error: 'Failed to fetch sources' }); }
});

app.get('/sources/:id/documents', authenticate, async (req: Request, res: Response) => {
    try { res.json({ documents: await registry.getDocsBySource(req.params.id as string) }); }
    catch (err) { res.status(500).json({ error: 'Failed to fetch documents' }); }
});

app.delete('/sources/:id', authenticate, async (req: Request, res: Response) => {
    try {
        await registry.deleteSource(req.params.id as string, (req as AuthedRequest).user.userId);
        res.json({ message: 'Collection removed from history.' });
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Stars ──────────────────────────────────────────────────────────────────────
app.post('/star', authenticate, async (req: Request, res: Response) => {
    try {
        const { location, fileName } = req.body as { location: string; fileName?: string };
        if (!location) { res.status(400).json({ error: 'location required' }); return; }
        await registry.starDocument(crypto.randomUUID(), (req as AuthedRequest).user.userId, location, fileName ?? location.split(/[\\/]/).pop() ?? location);
        res.json({ message: 'Starred successfully' });
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.delete('/star', authenticate, async (req: Request, res: Response) => {
    try {
        const { location } = req.body as { location: string };
        if (!location) { res.status(400).json({ error: 'location required' }); return; }
        await registry.unstarDocument((req as AuthedRequest).user.userId, location);
        res.json({ message: 'Unstarred successfully' });
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/starred', authenticate, async (req: Request, res: Response) => {
    try { res.json({ documents: await registry.getStarredDocuments((req as AuthedRequest).user.userId) }); }
    catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/starred/locations', authenticate, async (req: Request, res: Response) => {
    try { res.json({ locations: await registry.getStarredLocations((req as AuthedRequest).user.userId) }); }
    catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/list-models', (_req: Request, res: Response) => {
    res.json({ models: [], message: 'Model listing is handled automatically by provider detection.' });
});

// ── Start ──────────────────────────────────────────────────────────────────────
async function start() {
    await connectDB();
    app.listen(Number(PORT), () => {
        console.log(`🚀 [MCP] Server ready on port ${PORT}`);
        initScheduler();
    });
}

start().catch(err => { console.error('❌ [MCP] Failed to start:', err); process.exit(1); });

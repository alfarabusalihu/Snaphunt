# Snaphunt

AI-powered recruitment platform that intelligently ranks and analyzes candidates. Upload PDF resumes, embed them into a vector database, and use Google Gemini to deeply analyze candidates against job descriptions with automatic cloud-to-local fallback.

---

## ✨ Key Features

- **Smart CV Analysis**: AI-powered candidate ranking and deep analysis
- **Vector Search**: Fast semantic search using Qdrant vector database
- **Auto Fallback**: Automatically switches from cloud to local Qdrant if cloud is unavailable
- **Session Isolation**: Anonymous sessions don't persist; authenticated users get persistent collections
- **OCR Support**: Handles scanned PDFs with Tesseract OCR fallback
- **Batch Processing**: Concurrent PDF parsing and embedding for speed
- **Starred CVs**: Save and organize your top candidates (requires authentication)

---

## Architecture

```
Browser (React + Vite)
    │
    ▼ HTTP :3400
Express Gateway  (apps/backend/src/server.ts)
    │
    ▼ HTTP :3300
MCP Server       (apps/mcp-server/src/server.ts)   ← Auth, Ingest, Query, Analyse, Scheduler
    │                │
    ▼                ▼
Qdrant           MongoDB Atlas
(vectors)        (users, sources, documents, starred_cvs, analysis_cache)
 ↓ Auto-fallback
Local Qdrant
```

**Key flows**

| Flow | Steps |
|---|---|
| Ingest | Scan → Parse PDF → OCR fallback → Gemini structured extract → Chunk → Embed → Qdrant |
| Query | Embed query → Qdrant search → Aggregate by source → Rank |
| Analyse | Prune JD → Cache check → Build context → Gemini LLM → Cache results |
| Fallback | Cloud Qdrant fails → Auto-switch to local Qdrant at localhost:6333 |

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | Backend + frontend monorepo runtime |
| MongoDB | ≥ 5.0 | **Required** - MongoDB Atlas or local database for auth and starred CVs |
| Google Gemini API | — | **Required** - [Get one free](https://aistudio.google.com/) |
| Qdrant | any | **Optional** - [Cloud](https://cloud.qdrant.io) recommended, auto-falls back to local |

**Note**: If you don't configure cloud Qdrant, the system will automatically use local Qdrant at `http://localhost:6333`. To run local Qdrant:

```bash
docker run -p 6333:6333 qdrant/qdrant
```

---

## Local Development

Snaphunt is organized as a monorepo under the `apps/` directory:
- **`apps/backend`**: Express Gateway serving API requests and proxies.
- **`apps/mcp-server`**: RAG and database integration pipeline.
- **`apps/frontend`**: React + Tailwind CSS client dashboard.

### 1. Clone & install

```bash
git clone https://github.com/your-org/snaphunt.git
cd snaphunt

# Install all monorepo workspace dependencies
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Edit your `.env` at the root folder:

```env
PORT=3400
MCP_PORT=3300

# Required: MongoDB for authentication and starred CVs
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/snaphunt

# Optional: Cloud Qdrant (will auto-fallback to local if not provided)
QDRANT_URL=https://your-cluster.cloud.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key

# Frontend API URL
VITE_API_URL=http://localhost:3400
```

### 3. Start Qdrant (if using local)

If you're not using Qdrant Cloud, start a local instance:

```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 4. Run backend & MCP servers

Start both backend and MCP servers in development/watch mode concurrently:

```bash
npm run dev
```

The gateway listens on `http://localhost:3400`.  
The MCP server listens on `http://localhost:3300` (internal only).

### 5. Run frontend

Start the frontend development server:

```bash
npm run dev --prefix apps/frontend
# → http://localhost:5173
```

The frontend client makes requests to `http://localhost:3400` via `VITE_API_URL`.

---

## Production Build & Run

```bash
# 1. Build backend and MCP TypeScript code
npm run build

# 2. Start servers concurrently
npm start
```

---

## Docker Setup

### Single Container Build

```bash
docker build -t snaphunt .
docker run -p 3400:3400 \
  -e MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/snaphunt \
  -e QDRANT_URL=https://your-cluster.cloud.qdrant.io \
  -e QDRANT_API_KEY=your-key \
  -v $(pwd)/data:/app/data \
  snaphunt
```

### Docker Compose

Run full stack locally using Docker Compose:

```bash
# Prepare env configuration
cp .env.example .env

# Build and launch
docker compose up --build
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3400` | Express gateway external port |
| `MCP_PORT` | No | `3300` | Internal MCP server communication port |
| `MONGO_URI` | **Yes** | — | MongoDB connection string (required for auth and starred CVs) |
| `QDRANT_URL` | No | `http://localhost:6333` | Qdrant vector database endpoint (auto-fallback to local) |
| `QDRANT_API_KEY` | No | — | Qdrant Cloud API key (not needed for local) |
| `VITE_API_URL` | Frontend only | `http://localhost:3400` | Backend API URL embedded into frontend bundle at build-time |

---

## Session Management

Snaphunt has intelligent session handling:

- **Anonymous Users**: Sessions don't persist across browser closes - fresh start every time
- **Authenticated Users**: Work data (CV collections) persists in localStorage
- **Session Isolation**: Each browser session gets a unique ID - no cross-contamination
- **Stale State Detection**: Automatically clears incomplete analysis states on page reload

This ensures yesterday's unfinished work doesn't appear unless you're signed in!

---

## Project Structure

```
snaphunt/
├── apps/
│   ├── backend/               # Express gateway server
│   │   ├── src/
│   │   │   ├── server.ts      # Gateway (port 3400)
│   │   │   └── parser-bridge.ts
│   │   └── package.json
│   ├── mcp-server/            # MCP server
│   │   ├── src/
│   │   │   ├── server.ts      # MCP Server (port 3300)
│   │   │   ├── database/      # MongoDB connection and registry models
│   │   │   ├── parser/        # PDF parsing, OCR, ZIP extraction
│   │   │   ├── rag/           # Chunking, embedding, vector store (Qdrant)
│   │   │   ├── tools/         # analyzeCVs, queryTool, ingestTool
│   │   │   └── scheduler.ts   # Cron job scheduler
│   │   └── package.json
│   └── frontend/              # Frontend React application
│       ├── src/
│       │   ├── components/    # Reusable UI components
│       │   ├── pages/         # Home, Config, AuthPage
│       │   ├── store/         # Zustand store with smart persistence
│       │   ├── api.ts         # API requests client
│       │   ├── types.ts       # Domain data types
│       │   └── interfaces.ts  # Prop interfaces
│       └── package.json
├── data/                      # Token usage tracking files (gitignored)
├── temp_uploads/              # Multipart file upload storage
├── .env                       # Local environment configuration
├── .env.example               # Environment template for GitHub
├── package.json               # Root monorepo package.json
└── Dockerfile                 # Multi-stage production build
```

---

## First-Time Setup Walkthrough

1. Visit `http://localhost:5173` (or your production domain)
2. *Optional*: Register/Login for persistent collections and starred CVs
3. The **Configurations** page opens automatically
4. Enter your **Google Gemini API key**
5. Set a **Knowledge Source** — a local folder path (e.g. `C:/Resumes`) or remote URL
6. Add **Mandatory Skills** keywords to filter candidates
7. Click **Preview Candidates** — Snaphunt scans and displays PDF profiles
8. Click **Sync & Match Talent** — resumes are parsed, extracted, embedded, and stored
9. Paste a **Job Description** in the left panel
10. Click **Perform Deep Analysis** for comprehensive AI assessment
11. View ranked candidates, star top picks, download CVs, and export results!

---

## Troubleshooting

### Qdrant Connection Issues

If you see "Qdrant connection failed" errors:

1. **Check if local Qdrant is running**:
   ```bash
   docker ps | grep qdrant
   ```

2. **Start local Qdrant if needed**:
   ```bash
   docker run -p 6333:6333 qdrant/qdrant
   ```

3. **Verify cloud credentials** (if using cloud):
   - Check QDRANT_URL format (should be `https://xxx.cloud.qdrant.io`)
   - Verify QDRANT_API_KEY is correct
   - The system will auto-fallback to local if cloud fails

### Session State Issues

If you see old analysis results when opening the app:

- This is by design for anonymous users - simply refresh to clear
- Or sign in to persist your work across sessions
- Click "Config" → "Clear Records" to manually purge vector data

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

[MIT License](LICENSE)

---

## Support

For issues and questions:
- Open an issue on [GitHub Issues](https://github.com/your-org/snaphunt/issues)
- Check [Discussions](https://github.com/your-org/snaphunt/discussions) for community help

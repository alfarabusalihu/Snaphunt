# ── Stage 1: Build Frontend ───────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /app

COPY apps/frontend/package*.json ./apps/frontend/
RUN npm install --prefix apps/frontend

COPY apps/frontend/ ./apps/frontend/

ARG VITE_API_URL=http://localhost:3400
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build --prefix apps/frontend

# ── Stage 2: Build Backend + MCP ─────────────────────────────────────────────
FROM node:20-slim AS backend-builder
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install workspace packages
COPY package.json pnpm-workspace.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/
COPY apps/mcp-server/package.json ./apps/mcp-server/

RUN npm install

COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/
COPY apps/mcp-server/ ./apps/mcp-server/
COPY tsconfig.json ./

RUN npm run build --workspace=apps/backend
RUN npm run build --workspace=apps/mcp-server

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-workspace.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/
COPY apps/mcp-server/package.json ./apps/mcp-server/

RUN npm install --omit=dev

COPY --from=backend-builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=backend-builder /app/apps/mcp-server/dist ./apps/mcp-server/dist
COPY --from=frontend-builder /app/apps/frontend/dist ./apps/frontend/dist

RUN mkdir -p temp_uploads

ENV NODE_ENV=production
ENV PORT=3400
ENV MCP_PORT=3300

EXPOSE 3400

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3400/auth/me').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "-e", "import('./apps/backend/dist/server.js'); import('./apps/mcp-server/dist/server.js')"]

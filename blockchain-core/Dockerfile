# TrustLedger monolith: API + admin SPA + optional embedded USSD bridge (same public URL).
#
# Build context MUST be the Git repository root (parent of blockchain-core), so we can COPY ussd-bridge.
# Railway: set Root Directory to "/" (repo root), Dockerfile path "blockchain-core/Dockerfile", Variables from backend/.env.example.
# Also set BACKEND_API_URL / BACKEND_API_KEY on this service for the embedded bridge (same as ussd-service README).
#
FROM node:20-bookworm-slim AS admin-build
WORKDIR /build/admin-dashboard
COPY blockchain-core/admin-dashboard/package.json blockchain-core/admin-dashboard/package-lock.json ./
RUN npm ci
COPY blockchain-core/admin-dashboard/ ./
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_ADMIN_STATIC=true
# Same-process USSD bridge mounted at /ussd-bridge (override with USSD_BRIDGE_EMBED=false to disable)
ENV USSD_BRIDGE_EMBED=true
ENV USSD_BRIDGE_MOUNT_PATH=/ussd-bridge
# Log to stdout only in containers unless user sets ENABLE_ROTATE_FILE_LOG=true
ENV ENABLE_ROTATE_FILE_LOG=false
# Prisma generate does not need a live DB, only a syntactically valid URL.
ENV DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/railway_build"
COPY blockchain-core/backend/package.json blockchain-core/backend/package-lock.json ./
RUN npm ci && npm cache clean --force
COPY blockchain-core/backend/ ./
RUN npx prisma generate
COPY --from=admin-build /build/admin-dashboard/dist ../admin-dashboard/dist
COPY ussd-bridge/ussd-service ./ussd-service
RUN cd ussd-service && npm ci --omit=dev && npm cache clean --force
EXPOSE 3000
# `set -e` stops if migrate fails; echoes show clearly in Railway logs whether Node starts
CMD ["sh", "-c", "set -e; echo trustledger-prisma-migrate-start; npx prisma migrate deploy; echo trustledger-node-start; exec node server.js"]

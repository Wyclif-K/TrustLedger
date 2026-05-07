# TrustLedger monolith: build admin + run API on one URL (simplest Railway deploy).
# Split (API-only + static admin): use Dockerfile.api + Dockerfile.admin instead; see backend/.env.example.
# Railway: Root Directory `blockchain-core`, PostgreSQL plugin, env from backend/.env.example.
FROM node:20-bookworm-slim AS admin-build
WORKDIR /build/admin-dashboard
COPY admin-dashboard/package.json admin-dashboard/package-lock.json ./
RUN npm ci
COPY admin-dashboard/ ./
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_ADMIN_STATIC=true
# Log to stdout only in containers unless user sets ENABLE_ROTATE_FILE_LOG=true
ENV ENABLE_ROTATE_FILE_LOG=false
# Prisma generate does not need a live DB, only a syntactically valid URL.
ENV DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/railway_build"
COPY backend/package.json backend/package-lock.json ./
RUN npm ci && npm cache clean --force
COPY backend/ ./
RUN npx prisma generate
COPY --from=admin-build /build/admin-dashboard/dist ../admin-dashboard/dist
EXPOSE 3000
# `set -e` stops if migrate fails; echoes show clearly in Railway logs whether Node starts
CMD ["sh", "-c", "set -e; echo trustledger-prisma-migrate-start; npx prisma migrate deploy; echo trustledger-node-start; exec node server.js"]

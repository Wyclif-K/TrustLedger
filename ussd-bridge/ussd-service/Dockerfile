# =============================================================================
# TrustLedger USSD Bridge - Dockerfile
# Multi-stage build: dependencies → production image
# =============================================================================

# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S ussd  -u 1001 -G nodejs

WORKDIR /app

# Copy deps from stage 1
COPY --from=deps --chown=ussd:nodejs /app/node_modules ./node_modules

# Application source (see .dockerignore)
COPY --chown=ussd:nodejs package.json ./
COPY --chown=ussd:nodejs server.js app.js simulate.js ./
COPY --chown=ussd:nodejs config ./config
COPY --chown=ussd:nodejs handlers ./handlers
COPY --chown=ussd:nodejs middleware ./middleware
COPY --chown=ussd:nodejs services ./services
COPY --chown=ussd:nodejs utils ./utils

USER ussd

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "server.js"]

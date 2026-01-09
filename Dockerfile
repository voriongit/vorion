# Vorion Platform Dockerfile
# Multi-stage build for optimized production image

# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:20-alpine AS production

# Security: Run as non-root user
RUN addgroup -g 1001 -S vorion && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G vorion vorion

WORKDIR /app

# Copy built artifacts
COPY --from=builder --chown=vorion:vorion /app/dist ./dist
COPY --from=builder --chown=vorion:vorion /app/node_modules ./node_modules
COPY --chown=vorion:vorion package.json ./

# Create data directories
RUN mkdir -p /app/data/proofs && \
    chown -R vorion:vorion /app/data

# Switch to non-root user
USER vorion

# Environment
ENV NODE_ENV=production
ENV VORION_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Expose API port
EXPOSE 3000

# Start command
CMD ["node", "dist/index.js"]

# TrustBot API Server - Fly.io Deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Copy atsf-core local package first
COPY packages/atsf-core ./packages/atsf-core

# Copy package files (package.json references ./packages/atsf-core)
COPY package.json ./
COPY package-lock.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

# Build for production using esbuild (bundles into single file)
RUN npm run build:prod

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy atsf-core local package
COPY packages/atsf-core ./packages/atsf-core

# Copy package files
COPY package.json ./
COPY package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy any additional files needed at runtime
COPY .env* ./

# Expose port (Fly.io will set PORT env var)
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the API server
CMD ["node", "dist/api/index.js"]

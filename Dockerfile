# Multi-stage Dockerfile for Node.js + PM2 + Vault Agent
# Optimized for AWS App Runner deployment

# ============================================
# Stage 1: Build dependencies
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY backend/package*.json ./

# Install production dependencies only
RUN npm install

# ============================================
# Stage 2: Production runtime
# ============================================
FROM node:20-alpine AS runtime

# Install required tools (including gettext for envsubst, unzip for vault)
RUN apk add --no-cache \
    curl \
    bash \
    ca-certificates \
    gettext \
    unzip \
    && rm -rf /var/cache/apk/*

# Install Vault binary for Vault Agent (using linux_amd64 for x86_64)
ARG VAULT_VERSION=1.21.1
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then VAULT_ARCH="amd64"; \
    elif [ "$ARCH" = "aarch64" ]; then VAULT_ARCH="arm64"; \
    else VAULT_ARCH="amd64"; fi && \
    curl -fsSL https://releases.hashicorp.com/vault/${VAULT_VERSION}/vault_${VAULT_VERSION}_linux_${VAULT_ARCH}.zip -o vault.zip && \
    unzip vault.zip -d /usr/local/bin/ && \
    rm vault.zip && \
    chmod +x /usr/local/bin/vault

# Install PM2 globally
RUN npm install -g pm2

# Create app directory and secrets directory
WORKDIR /app
RUN mkdir -p /etc/nodeapp

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY backend/ ./

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 \
    && chown -R nodejs:nodejs /app /etc/nodeapp

USER nodejs

# Expose application port
EXPOSE 5000

# Health check for App Runner
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/api/health/live || exit 1

# Start application
ENTRYPOINT ["/docker-entrypoint.sh"]

#!/bin/bash
set -e

echo "============================================"
echo "Starting container initialization..."
echo "============================================"

# Check if VAULT_SKIP is set (for local testing without Vault)
if [ "${VAULT_SKIP}" = "true" ]; then
    echo "⚠️  VAULT_SKIP=true - Skipping Vault Agent, using local .env"
    if [ -f "/app/.env" ]; then
        mkdir -p /etc/nodeapp
        cp /app/.env /etc/nodeapp/.env.generated
        echo "✅ Copied local .env to /etc/nodeapp/.env.generated"
    else
        echo "❌ No .env file found and VAULT_SKIP=true"
        echo "   Please provide a .env file or configure Vault"
        exit 1
    fi
else
    # Validate required environment variables
    if [ -z "${VAULT_ADDR}" ]; then
        echo "❌ VAULT_ADDR is not set"
        exit 1
    fi

    if [ -z "${VAULT_ROLE}" ]; then
        echo "❌ VAULT_ROLE is not set"
        exit 1
    fi

    if [ -z "${VAULT_SECRET_PATH}" ]; then
        echo "❌ VAULT_SECRET_PATH is not set"
        exit 1
    fi

    echo "🔐 Vault Configuration:"
    echo "   VAULT_ADDR: ${VAULT_ADDR}"
    echo "   VAULT_ROLE: ${VAULT_ROLE}"
    echo "   VAULT_SECRET_PATH: ${VAULT_SECRET_PATH}"
    echo ""

    # Create secrets directory if it doesn't exist
    mkdir -p /etc/nodeapp

    # Run Vault Agent to fetch secrets (initial fetch)
    echo "🔄 Running Vault Agent to fetch secrets..."
    
    # Generate config with environment variables substituted
    envsubst < /app/vault/vault-agent-config.hcl > /tmp/vault-agent-config.hcl
    
    vault agent -config=/tmp/vault-agent-config.hcl -exit-after-auth
    
    if [ $? -eq 0 ] && [ -f "/etc/nodeapp/.env.generated" ]; then
        echo "✅ Secrets successfully loaded from Vault"
    else
        echo "❌ Failed to load secrets from Vault"
        exit 1
    fi
fi

echo ""
echo "============================================"
echo "Starting PM2..."
echo "============================================"

# Source environment variables so PM2 can access them
if [ -f "/etc/nodeapp/.env.generated" ]; then
    echo "📥 Loading environment from /etc/nodeapp/.env.generated"
    set -a
    source /etc/nodeapp/.env.generated
    set +a
fi

# Start PM2 with ecosystem config
cd /app
pm2-runtime start ecosystem.config.js --env production

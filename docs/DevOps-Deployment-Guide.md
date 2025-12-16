# AWS Deployment Guide
## Complete Setup Documentation

**Version:** 1.0 | **Date:** December 2024

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites](#3-prerequisites)
4. [Frontend Deployment](#4-frontend-deployment)
5. [Backend Deployment](#5-backend-deployment)
6. [Verification & Testing](#6-verification--testing)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Introduction

### What This Document Covers

This guide explains how to deploy a full-stack web application to AWS:

| Component | Technology | Hosting |
|-----------|------------|---------|
| **Frontend** | React.js | S3 + CloudFront |
| **Backend** | Node.js | App Runner |
| **Database** | MySQL | Amazon RDS |
| **Secrets** | HashiCorp Vault | EC2 |

### Two Separate Pipelines

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DEPLOYMENT PIPELINES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   FRONTEND PIPELINE                    BACKEND PIPELINE                      │
│   ─────────────────                    ────────────────                      │
│                                                                              │
│   Developer pushes to                  Developer pushes to                   │
│   frontend/ folder                     backend/ folder                       │
│         │                                    │                               │
│         ▼                                    ▼                               │
│   GitHub Actions:                      GitHub Actions:                       │
│   • npm run build                      • Docker build                        │
│   • Upload to S3                       • Push to ECR                         │
│   • Clear CDN cache                    • Deploy to App Runner                │
│         │                                    │                               │
│         ▼                                    ▼                               │
│   Live on CloudFront                   Live on App Runner                    │
│   (~2 minutes)                         (~3 minutes)                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Overview

### Simple View

```
     Users
       │
       ▼
  Your Domain (Route 53)
       │
       ├── app.example.com ────► CloudFront ────► S3 (React files)
       │
       └── api.example.com ────► App Runner ────► Node.js API
                                      │
                              ┌───────┴───────┐
                              ▼               ▼
                           Vault           RDS MySQL
                         (Secrets)        (Database)
```

### Detailed View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                AWS CLOUD                                     │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         PUBLIC INTERNET                               │   │
│  │                                                                       │   │
│  │   ┌─────────────┐                           ┌─────────────┐          │   │
│  │   │  CloudFront │ ◄── HTTPS ──              │  App Runner │          │   │
│  │   │    (CDN)    │            │              │  (Backend)  │          │   │
│  │   └──────┬──────┘            │              └──────┬──────┘          │   │
│  │          │                   │                     │                  │   │
│  │   ┌──────▼──────┐     ┌──────┴──────┐       ┌──────▼──────┐          │   │
│  │   │  S3 Bucket  │     │  Route 53   │       │     VPC     │          │   │
│  │   │  (Frontend) │     │   (DNS)     │       │  Connector  │          │   │
│  │   └─────────────┘     └─────────────┘       └──────┬──────┘          │   │
│  │                                                    │                  │   │
│  └────────────────────────────────────────────────────┼──────────────────┘   │
│                                                       │                      │
│  ┌────────────────────────────────────────────────────┼──────────────────┐   │
│  │                    PRIVATE NETWORK (VPC)           │                  │   │
│  │                    Not accessible from internet    │                  │   │
│  │                                                    │                  │   │
│  │        ┌───────────────────────┬───────────────────┘                  │   │
│  │        │                       │                                      │   │
│  │        ▼                       ▼                                      │   │
│  │  ┌───────────────┐      ┌───────────────┐                            │   │
│  │  │ HashiCorp     │      │ Amazon RDS    │                            │   │
│  │  │ Vault         │      │ (MySQL)       │                            │   │
│  │  │               │      │               │                            │   │
│  │  │ Stores all    │      │ Your app      │                            │   │
│  │  │ passwords     │      │ data          │                            │   │
│  │  └───────────────┘      └───────────────┘                            │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Prerequisites

### What You Need Before Starting

| Requirement | Purpose | How to Get It |
|-------------|---------|---------------|
| **AWS Account** | Host the application | [aws.amazon.com](https://aws.amazon.com) |
| **GitHub Account** | Store code & run deployments | [github.com](https://github.com) |
| **Domain Name** | Your website address | Buy from any registrar |

### AWS Services We'll Use

| Service | What It Does | Cost (Estimated) |
|---------|--------------|------------------|
| **S3** | Stores frontend files | ~$1/month |
| **CloudFront** | Makes website fast globally | ~$5/month |
| **App Runner** | Runs backend code | ~$40/month |
| **RDS** | Database | ~$50/month |
| **Route 53** | Manages domain | ~$1/month |
| **ECR** | Stores Docker images | ~$1/month |

---

## 4. Frontend Deployment

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND PIPELINE                             │
│                                                                  │
│   Step 1         Step 2         Step 3         Step 4           │
│   ───────        ───────        ───────        ───────          │
│                                                                  │
│   Code Push  ──► Build App ──► Upload to ──► Clear Cache        │
│   to GitHub      (React)        S3 Bucket     (CloudFront)       │
│                                                                  │
│   Trigger:       Creates:       Files go      Users see          │
│   Push to        dist/ folder   to cloud      new version        │
│   main branch    with HTML,     storage       immediately        │
│                  CSS, JS                                         │
│                                                                  │
│   Time: ~2 minutes total                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Step 4.1: Create S3 Bucket

**What is S3?** A storage service where we put your website files.

1. Go to AWS Console → S3
2. Click "Create bucket"
3. Settings:

| Setting | Value |
|---------|-------|
| Bucket name | `your-frontend-bucket` (must be unique) |
| Region | `ap-south-1` (or your preferred region) |
| Block public access | ✅ Keep ON (CloudFront will access it) |

### Step 4.2: Create CloudFront Distribution

**What is CloudFront?** A service that makes your website load fast from anywhere in the world.

1. Go to AWS Console → CloudFront
2. Click "Create distribution"
3. Settings:

| Setting | Value |
|---------|-------|
| Origin domain | Select your S3 bucket |
| Origin access | Origin access control (OAC) |
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Default root object | `index.html` |

4. After creation, copy the **Distribution ID** (you'll need it later)

### Step 4.3: Set Up S3 Bucket Policy

This allows CloudFront to read your S3 files.

1. Go to S3 → Your bucket → Permissions → Bucket policy
2. Add this policy (replace the values):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR-ACCOUNT-ID:distribution/YOUR-DISTRIBUTION-ID"
        }
      }
    }
  ]
}
```

### Step 4.4: Create GitHub Actions Workflow

**What is GitHub Actions?** An automation tool that deploys your code when you push changes.

Create file: `.github/workflows/frontend.yml`

```yaml
name: Deploy Frontend

# When does this run?
on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'  # Only when frontend code changes

# Permissions for AWS access
permissions:
  id-token: write
  contents: read

# Configuration
env:
  AWS_REGION: ap-south-1
  S3_BUCKET: your-frontend-bucket          # ← Change this
  CLOUDFRONT_DISTRIBUTION_ID: EXXXXXXXXXX  # ← Change this

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      # Step 1: Get the code
      - name: Checkout code
        uses: actions/checkout@v4

      # Step 2: Setup Node.js
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      # Step 3: Install dependencies
      - name: Install dependencies
        run: npm ci
        working-directory: frontend

      # Step 4: Build the React app
      - name: Build
        run: npm run build
        working-directory: frontend

      # Step 5: Login to AWS
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      # Step 6: Upload to S3
      - name: Deploy to S3
        run: aws s3 sync frontend/dist s3://${{ env.S3_BUCKET }} --delete

      # Step 7: Clear CloudFront cache
      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ env.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

### Step 4.5: Add GitHub Secret

1. Go to GitHub → Your repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add:

| Name | Value |
|------|-------|
| `AWS_ROLE_ARN` | `arn:aws:iam::YOUR-ACCOUNT:role/GitHubActionsRole` |

---

## 5. Backend Deployment

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND PIPELINE                             │
│                                                                  │
│   Step 1         Step 2         Step 3         Step 4           │
│   ───────        ───────        ───────        ───────          │
│                                                                  │
│   Code Push  ──► Build      ──► Push to  ──► Deploy to          │
│   to GitHub      Docker         ECR          App Runner          │
│                  Image          Registry                         │
│                                                                  │
│   Trigger:       Creates a      Image        App Runner          │
│   Push to        container      stored       pulls new           │
│   main branch    package        in AWS       image, restarts     │
│                                                                  │
│   Time: ~3-4 minutes total                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Step 5.1: Create ECR Repository

**What is ECR?** A place to store Docker images (packaged code).

1. Go to AWS Console → ECR
2. Click "Create repository"
3. Settings:

| Setting | Value |
|---------|-------|
| Repository name | `your-app/backend` |
| Image scan | ✅ Enabled |

4. Copy the repository URI (e.g., `123456789.dkr.ecr.ap-south-1.amazonaws.com/your-app/backend`)

### Step 5.2: Create VPC Connector

**What is VPC Connector?** A bridge that lets App Runner connect to your private database and Vault.

1. Go to AWS Console → App Runner → VPC connectors
2. Click "Create"
3. Settings:

| Setting | Value |
|---------|-------|
| Name | `vault-rds-connector` |
| VPC | Select your VPC |
| Subnets | Select private subnets |
| Security group | Create one allowing ports 8200 (Vault) and 3306 (MySQL) |

### Step 5.3: Create App Runner Service

**What is App Runner?** A service that runs your backend code automatically.

1. Go to AWS Console → App Runner
2. Click "Create service"
3. Settings:

| Setting | Value |
|---------|-------|
| Source | Container registry (Amazon ECR) |
| ECR repository | Select your repository |
| Deployment | Automatic |
| CPU | 1 vCPU |
| Memory | 2 GB |
| Port | 5000 |

4. Environment variables:

| Variable | Value |
|----------|-------|
| `VAULT_ADDR` | `http://YOUR-VAULT-IP:8200` |
| `VAULT_ROLE` | `node-api` |
| `VAULT_SECRET_PATH` | `kv/data/secrets/nodeapp` |

5. Networking → Select your VPC connector

6. Copy the **Service ARN** (you'll need it later)

### Step 5.4: Create Dockerfile

**What is Dockerfile?** Instructions to package your code into a container.

Create file: `Dockerfile` (in project root)

```dockerfile
# Stage 1: Build dependencies
FROM node:20-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production

# Stage 2: Create runtime image
FROM node:20-alpine
WORKDIR /app

# Install required tools
RUN apk add --no-cache curl bash ca-certificates gettext unzip

# Install Vault (for secret management)
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then VAULT_ARCH="amd64"; \
    elif [ "$ARCH" = "aarch64" ]; then VAULT_ARCH="arm64"; fi && \
    curl -fsSL https://releases.hashicorp.com/vault/1.15.4/vault_1.15.4_linux_${VAULT_ARCH}.zip \
    -o vault.zip && unzip vault.zip && mv vault /usr/local/bin/ && rm vault.zip

# Install PM2 (process manager)
RUN npm install -g pm2

# Create non-root user (security best practice)
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -s /bin/sh -D nodejs

# Copy application files
COPY --from=builder /app/node_modules ./node_modules
COPY backend/ ./
COPY docker-entrypoint.sh /usr/local/bin/

# Set permissions
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    mkdir -p /etc/nodeapp && \
    chown -R nodejs:nodejs /app /etc/nodeapp

# Run as non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start the application
ENTRYPOINT ["docker-entrypoint.sh"]
```

### Step 5.5: Create Entrypoint Script

**What is this?** A script that runs when the container starts.

Create file: `docker-entrypoint.sh`

```bash
#!/bin/bash
set -e

echo "Starting application..."

# Check if we should skip Vault (for local testing)
if [ "${VAULT_SKIP}" = "true" ]; then
    echo "VAULT_SKIP=true - Using local .env file"
    cp /app/.env /etc/nodeapp/.env.generated 2>/dev/null || true
else
    echo "Connecting to Vault for secrets..."
    
    # Create Vault config with environment variables
    envsubst < /app/vault/vault-agent-config.hcl > /tmp/vault-agent-config.hcl
    
    # Start Vault Agent in background
    vault agent -config=/tmp/vault-agent-config.hcl &
    
    # Wait for secrets to be fetched (max 60 seconds)
    TIMEOUT=60
    ELAPSED=0
    while [ ! -f "/etc/nodeapp/.env.generated" ] && [ $ELAPSED -lt $TIMEOUT ]; do
        sleep 1
        ELAPSED=$((ELAPSED + 1))
    done
    
    if [ ! -f "/etc/nodeapp/.env.generated" ]; then
        echo "ERROR: Timed out waiting for Vault secrets"
        exit 1
    fi
    
    echo "Secrets loaded successfully"
fi

# Load environment variables
set -a
source /etc/nodeapp/.env.generated
set +a

# Start the application with PM2
echo "Starting Node.js application..."
exec pm2-runtime start ecosystem.config.js --env production
```

### Step 5.6: Create GitHub Actions Workflow

Create file: `.github/workflows/backend.yml`

```yaml
name: Deploy Backend

# When does this run?
on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'Dockerfile'
      - 'docker-entrypoint.sh'

# Permissions for AWS access
permissions:
  id-token: write
  contents: read

# Configuration
env:
  AWS_REGION: ap-south-1
  ECR_REPOSITORY: your-app/backend                                    # ← Change this
  APP_RUNNER_SERVICE_ARN: arn:aws:apprunner:ap-south-1:123456:service/backend/xxx  # ← Change this

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      # Step 1: Get the code
      - name: Checkout code
        uses: actions/checkout@v4

      # Step 2: Login to AWS
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      # Step 3: Login to ECR
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      # Step 4: Build and push Docker image
      - name: Build and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          echo "Building Docker image..."
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          
          echo "Pushing to ECR..."
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      # Step 5: Deploy to App Runner
      - name: Deploy to App Runner
        run: |
          echo "Triggering App Runner deployment..."
          aws apprunner start-deployment \
            --service-arn ${{ env.APP_RUNNER_SERVICE_ARN }}
          echo "Deployment started! It will be live in ~2-3 minutes."
```

---

## 6. Verification & Testing

### After Frontend Deployment

Check these things to confirm success:

| Check | How to Verify |
|-------|---------------|
| S3 files uploaded | AWS Console → S3 → Your bucket → Check files exist |
| CloudFront working | Visit your CloudFront URL (dxxxxx.cloudfront.net) |
| Custom domain | Visit your domain (app.example.com) |

### After Backend Deployment

| Check | How to Verify |
|-------|---------------|
| ECR image pushed | AWS Console → ECR → Your repo → Check image with latest tag |
| App Runner deployed | AWS Console → App Runner → Your service → Status = "Running" |
| API responding | Visit: `https://your-app.awsapprunner.com/api/health` |

### Expected Health Response

```json
{
  "status": "UP",
  "timestamp": "2024-12-16T10:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "database": "connected"
}
```

### Quick Test Commands

```bash
# Test frontend (should return HTML)
curl https://app.example.com

# Test backend health
curl https://api.example.com/api/health

# Test backend API
curl https://api.example.com/api/users
```

---

## 7. Troubleshooting

### Frontend Issues

| Problem | Possible Cause | Solution |
|---------|----------------|----------|
| Build fails | npm dependencies issue | Check `package.json`, run `npm ci` locally |
| S3 upload fails | Permission issue | Check IAM role has S3 permissions |
| Site not updating | CloudFront cache | Wait for invalidation or create new one |
| 403 Forbidden | S3 bucket policy | Check bucket policy allows CloudFront |

### Backend Issues

| Problem | Possible Cause | Solution |
|---------|----------------|----------|
| Docker build fails | Dockerfile error | Build locally first: `docker build .` |
| ECR push fails | Permission issue | Check IAM role has ECR permissions |
| App Runner unhealthy | App crashes | Check CloudWatch logs for errors |
| Can't connect to DB | Security group | Ensure VPC connector SG allows port 3306 |
| Vault connection fails | Network issue | Check Vault SG allows port 8200 |

### How to Check Logs

**App Runner Logs:**
1. AWS Console → App Runner → Your service
2. Click "Logs" tab
3. View application logs

**CloudWatch Logs:**
1. AWS Console → CloudWatch → Log groups
2. Find `/aws/apprunner/your-service/application`
3. Click to view logs

### Common Error Messages

| Error | Meaning | Fix |
|-------|---------|-----|
| `VAULT_ADDR is not set` | Missing environment variable | Add VAULT_ADDR in App Runner config |
| `permission denied` | IAM issue | Check IAM roles and policies |
| `connection refused` | Network blocked | Check security groups |
| `502 Bad Gateway` | App crashed | Check application logs |
| `health check failed` | App not responding | Ensure /api/health endpoint works |

---

## Summary

### What We Set Up

| Component | Service | Trigger |
|-----------|---------|---------|
| Frontend | S3 + CloudFront | Push to `frontend/` folder |
| Backend | App Runner | Push to `backend/` folder |

### Deployment Flow

```
Developer makes changes
         │
         ├── Frontend changes ──► GitHub Actions ──► S3 + CloudFront ──► Live (~2 min)
         │
         └── Backend changes ──► GitHub Actions ──► ECR ──► App Runner ──► Live (~3 min)
```

### Key URLs to Remember

| Purpose | URL |
|---------|-----|
| Frontend | `https://app.example.com` |
| Backend API | `https://api.example.com` |
| Health Check | `https://api.example.com/api/health` |

---

*Need help? Contact: [Your DevOps Team Email]*

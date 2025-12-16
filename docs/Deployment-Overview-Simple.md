# Backend API Deployment Overview

## What We Built

A **serverless backend API** that runs your Node.js application with automatic scaling, zero server management, and secure secret handling.

---

## How It Works (Simple Explanation)

```
    👤 User Request
         │
         ▼
    ┌─────────────┐
    │  Internet   │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐     "Where is api.yourapp.com?"
    │  Route 53   │ ◄── DNS translates domain to IP
    └──────┬──────┘
           │
           ▼
    ┌─────────────────────────────────────┐
    │         AWS App Runner              │
    │  ┌─────────────────────────────┐   │
    │  │     Your Backend API        │   │
    │  │  • Handles API requests     │   │
    │  │  • Connects to database     │   │
    │  │  • Returns JSON responses   │   │
    │  └─────────────────────────────┘   │
    │                                     │
    │  ✓ Auto-scales with traffic        │
    │  ✓ No servers to manage            │
    │  ✓ Automatic HTTPS                 │
    └─────────────────┬───────────────────┘
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
    ┌─────────────┐       ┌─────────────┐
    │   Vault     │       │   Database  │
    │  (Secrets)  │       │   (MySQL)   │
    └─────────────┘       └─────────────┘
```

---

## The 4 Main Components

### 1. 🚀 AWS App Runner (The Engine)
**What it does:** Runs your application automatically

| Feature | Benefit |
|---------|---------|
| Auto-scaling | Handles 1 user or 10,000 users automatically |
| Zero servers | No EC2 instances to maintain or patch |
| Auto-deploy | New code goes live when pushed to GitHub |
| Built-in HTTPS | Secure connections out-of-the-box |

**Think of it like:** A self-driving car for your application - it runs, scales, and heals itself.

---

### 2. 🔐 HashiCorp Vault (The Safe)
**What it does:** Stores and protects sensitive information

| What's Protected | Why It Matters |
|-----------------|----------------|
| Database passwords | No passwords in code |
| API keys | Secrets never exposed |
| Configuration | Environment-specific settings |

**Think of it like:** A bank vault that automatically gives your app the right keys when needed.

**How secrets flow:**
```
Vault (Secure Storage)
       │
       │ Every 1 minute, checks for changes
       ▼
┌─────────────────┐
│  Vault Agent    │ ◄── Lives inside container
│  (Secret Fetcher)│
└────────┬────────┘
         │
         │ Automatically restarts app with new secrets
         ▼
┌─────────────────┐
│  Your App       │
└─────────────────┘
```

---

### 3. 🔄 GitHub Actions (The Builder)
**What it does:** Automatically builds and deploys your code

```
Developer pushes code ──▶ GitHub ──▶ Build ──▶ Deploy ──▶ Live!
        │                              │          │
        │                              │          │
     5 seconds                    2-3 minutes   Automatic
```

**The process:**
1. ✅ Developer pushes code to GitHub
2. ✅ GitHub Actions detects the change
3. ✅ Builds a new container image
4. ✅ Pushes to AWS container registry
5. ✅ App Runner deploys automatically
6. ✅ New version is live!

---

### 4. 🗄️ Amazon RDS (The Database)
**What it does:** Stores your application data

| Feature | Benefit |
|---------|---------|
| Managed service | AWS handles backups & maintenance |
| Multi-AZ | Automatic failover if something fails |
| Encrypted | Data protected at rest and in transit |

---

## How Deployment Works

### Automatic Deployments (Every Code Change)

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌───────────┐
│  Developer  │───▶│   GitHub     │───▶│   Build &   │───▶│   Live!   │
│  pushes     │    │   (main)     │    │   Deploy    │    │           │
│  code       │    │              │    │   (~3 min)  │    │           │
└─────────────┘    └──────────────┘    └─────────────┘    └───────────┘
```

### Secret Updates (No Deployment Needed)

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Admin      │───▶│   Vault      │───▶│   App auto- │
│  updates    │    │   (secrets)  │    │   restarts  │
│  password   │    │              │    │   (~1 min)  │
└─────────────┘    └──────────────┘    └─────────────┘
```

---

## Security Highlights

| Security Layer | Protection |
|----------------|------------|
| **No static credentials** | App uses AWS IAM - no passwords in code |
| **Encrypted secrets** | Vault encrypts all sensitive data |
| **Private network** | Database not exposed to internet |
| **Automatic HTTPS** | All traffic encrypted |
| **Audit trail** | All secret access is logged |

---

## Monitoring & Health

### Health Check Endpoints

| Endpoint | Purpose | What It Shows |
|----------|---------|---------------|
| `/api/health/live` | Is it running? | Basic status |
| `/api/health/ready` | Can it accept traffic? | Database connection |
| `/api/health` | Full system status | Memory, uptime, connections |

### Where to Check Status

- **App Runner Console**: See deployments, logs, scaling
- **CloudWatch**: View metrics and set alerts
- **Vault**: Audit secret access

---

## Cost Overview

| Component | ~Monthly Cost | Notes |
|-----------|---------------|-------|
| App Runner | $40-60 | Based on usage |
| Database (RDS) | $50-70 | db.t3.small |
| Vault Server | $15-20 | EC2 t3.small |
| Other (ECR, VPC) | $10-15 | Storage & networking |
| **Total** | **$115-165** | Varies with traffic |

---

## Comparison: Old vs New Architecture

| Aspect | Old (EC2 + ASG) | New (App Runner) |
|--------|-----------------|------------------|
| **Servers to manage** | 2-4 EC2 instances | Zero |
| **Scaling speed** | Minutes | Seconds |
| **Patching** | Manual/Scheduled | Automatic |
| **Deployment** | Complex (Ansible) | Push to GitHub |
| **Load balancer** | Separate ALB | Built-in |
| **SSL certificates** | Manual renewal | Automatic |

---

## Quick Reference

### Update a Secret
```bash
vault kv put kv/secrets/nodeapp DB_PASSWORD=new-password
# App automatically restarts within 1 minute
```

### Deploy New Code
```bash
git push origin main
# Automatic deployment starts
```

### Check App Status
```bash
curl https://your-app.awsapprunner.com/api/health
```

---

## Support Contacts

| Issue | Contact |
|-------|---------|
| Application bugs | Development team |
| AWS infrastructure | DevOps team |
| Vault/Secrets | Security team |

---

*Document Version: 1.0 | Last Updated: December 2024*

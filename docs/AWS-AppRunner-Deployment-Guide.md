# AWS App Runner Backend Deployment
## Technical Design Document

**Project:** Backend API Serverless Deployment  
**Version:** 1.0  
**Date:** December 2024  
**Status:** Production

---

## Table of Contents

1. [Introduction/Abstract](#1-introductionabstract)
2. [System Specification/Architecture](#2-system-specificationarchitecture)
3. [Implementation Steps](#3-implementation-steps)
4. [Security and Compliance](#4-security-and-compliance)
5. [Operational Procedures](#5-operational-procedures)
6. [Cost Optimization](#6-cost-optimization)

---

## 1. Introduction/Abstract

### 1.1 Project Overview

This document describes the deployment architecture for a **serverless backend API** using AWS App Runner with HashiCorp Vault for dynamic secrets management. The solution provides automatic scaling, zero infrastructure management, and enhanced security through dynamic secret rotation.

### 1.2 Business Objectives

| Objective | Solution |
|-----------|----------|
| Reduce operational overhead | Serverless architecture with App Runner |
| Improve security posture | Dynamic secrets via HashiCorp Vault |
| Enable rapid deployments | CI/CD pipeline with GitHub Actions |
| Minimize infrastructure costs | Pay-per-use pricing model |
| Ensure high availability | Multi-AZ database, auto-scaling containers |

### 1.3 Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 + PM2 |
| Container | Docker (Alpine Linux) |
| Compute | AWS App Runner |
| Database | Amazon RDS (MySQL) |
| Secrets | HashiCorp Vault |
| CI/CD | GitHub Actions |
| Container Registry | Amazon ECR |
| DNS | Amazon Route 53 |

### 1.4 Scope

**In Scope:**
- Backend API deployment on App Runner
- Database connectivity via VPC Connector
- Secret management with Vault Agent
- CI/CD pipeline for automated deployments
- Health monitoring and logging

**Out of Scope:**
- Frontend deployment (documented separately)
- Vault server installation (pre-existing)
- DNS domain registration

---

## 2. System Specification/Architecture

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    INTERNET                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Amazon Route 53                                     │
│                         (DNS - api.example.com)                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            AWS App Runner Service                                │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         Docker Container                                   │  │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐│  │
│  │  │      Node.js + PM2          │  │         Vault Agent                 ││  │
│  │  │    (Backend API Server)     │  │   (Secret Fetcher & Rotator)        ││  │
│  │  │                             │  │                                     ││  │
│  │  │  • Express.js REST API      │  │  • AWS IAM Authentication           ││  │
│  │  │  • Health check endpoints   │  │  • Auto-refresh every 1 minute      ││  │
│  │  │  • MySQL database client    │  │  • PM2 restart on secret change     ││  │
│  │  └─────────────────────────────┘  └─────────────────────────────────────┘│  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  Features: Auto-scaling (0-N) | Built-in HTTPS | Health checks | Auto-deploy   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                          ┌──────────────┴──────────────┐
                          │       VPC Connector         │
                          │  (Bridge to Private VPC)    │
                          └──────────────┬──────────────┘
                                         │
┌────────────────────────────────────────┼────────────────────────────────────────┐
│                              PRIVATE VPC                                         │
│                                        │                                         │
│           ┌────────────────────────────┼────────────────────────────┐           │
│           │                            │                            │           │
│           ▼                            ▼                            ▼           │
│  ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐  │
│  │ HashiCorp Vault │          │   Amazon RDS    │          │   NAT Gateway   │  │
│  │                 │          │    (MySQL)      │          │                 │  │
│  │ • KV v2 Secrets │          │ • Multi-AZ      │          │ • Outbound      │  │
│  │ • AWS IAM Auth  │          │ • Encrypted     │          │   Internet      │  │
│  │ • Audit Logging │          │ • Auto-backup   │          │                 │  │
│  └─────────────────┘          └─────────────────┘          └─────────────────┘  │
│                                                                                  │
│  Private Subnets: 10.0.4.0/24 (AZ-A) | 10.0.5.0/24 (AZ-B) | 10.0.6.0/24 (AZ-C) │
└──────────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────────┐
│                              CI/CD PIPELINE                                       │
│                                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   GitHub     │───▶│   GitHub     │───▶│  Amazon ECR  │───▶│  App Runner  │   │
│  │ Repository   │    │   Actions    │    │  (Registry)  │    │  (Deploy)    │   │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                                                   │
│  Trigger: Push to main branch | Build time: ~3 minutes | Zero-downtime deploy   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Network Architecture

#### VPC Configuration

| Component | CIDR/Configuration |
|-----------|-------------------|
| VPC | 10.0.0.0/16 |
| Public Subnet 1 (AZ-A) | 10.0.1.0/24 |
| Public Subnet 2 (AZ-B) | 10.0.2.0/24 |
| Public Subnet 3 (AZ-C) | 10.0.3.0/24 |
| Private Subnet 1 (AZ-A) | 10.0.4.0/24 |
| Private Subnet 2 (AZ-B) | 10.0.5.0/24 |
| Private Subnet 3 (AZ-C) | 10.0.6.0/24 |

#### Routing

| Route Table | Destination | Target |
|-------------|-------------|--------|
| Public | 0.0.0.0/0 | Internet Gateway |
| Private | 0.0.0.0/0 | NAT Gateway |
| Private | 10.0.0.0/16 | Local |

### 2.3 Container Architecture

```dockerfile
# Multi-stage build
┌─────────────────────────────────────────────┐
│ Stage 1: Builder                            │
│ • Node.js 20 Alpine                         │
│ • npm install (production dependencies)     │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ Stage 2: Runtime                            │
│ • Node.js 20 Alpine                         │
│ • Vault binary (for Vault Agent)            │
│ • PM2 (process manager)                     │
│ • gettext (envsubst)                        │
│ • Application code                          │
│ • Non-root user (security)                  │
└─────────────────────────────────────────────┘
```

### 2.4 Data Flow

```
1. User Request Flow:
   User → Route 53 → App Runner → Node.js App → RDS Database

2. Secret Flow:
   Vault Agent → Vault Server → .env.generated → PM2 → Node.js App

3. Deployment Flow:
   Developer → GitHub → Actions → ECR → App Runner → Live
```

---

## 3. Implementation Steps

### 3.1 Prerequisites

| Requirement | Details |
|-------------|---------|
| AWS Account | With appropriate permissions |
| GitHub Repository | Source code repository |
| HashiCorp Vault | Running instance with AWS IAM auth enabled |
| Domain (optional) | For custom domain routing |

### 3.2 Step 1: VPC and Networking Setup

```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16

# Create subnets (private for RDS and Vault)
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.4.0/24 --availability-zone ap-south-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.5.0/24 --availability-zone ap-south-1b

# Create NAT Gateway for outbound internet access
aws ec2 create-nat-gateway --subnet-id subnet-public --allocation-id eipalloc-xxx
```

### 3.3 Step 2: Security Groups

#### VPC Connector Security Group
```bash
aws ec2 create-security-group \
  --group-name apprunner-vpc-connector-sg \
  --description "App Runner VPC Connector" \
  --vpc-id vpc-xxx

# Outbound rules
aws ec2 authorize-security-group-egress \
  --group-id sg-connector \
  --protocol tcp --port 8200 --source-group sg-vault    # Vault
  
aws ec2 authorize-security-group-egress \
  --group-id sg-connector \
  --protocol tcp --port 3306 --source-group sg-rds      # RDS

aws ec2 authorize-security-group-egress \
  --group-id sg-connector \
  --protocol tcp --port 443 --cidr 0.0.0.0/0            # AWS APIs
```

#### Vault Security Group
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-vault \
  --protocol tcp --port 8200 --source-group sg-connector
```

#### RDS Security Group
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds \
  --protocol tcp --port 3306 --source-group sg-connector
```

### 3.4 Step 3: Amazon ECR Repository

```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name uday/backend \
  --image-scanning-configuration scanOnPush=true
```

### 3.5 Step 4: VPC Connector for App Runner

```bash
aws apprunner create-vpc-connector \
  --vpc-connector-name vault-rds-connector \
  --subnets subnet-private-1 subnet-private-2 \
  --security-groups sg-connector
```

### 3.6 Step 5: HashiCorp Vault Configuration

#### Enable AWS IAM Auth
```bash
vault auth enable aws

vault write auth/aws/config/client \
    iam_server_id_header_value=vault.example.com
```

#### Create Policy for Application
```bash
vault policy write nodeapp-secrets - <<EOF
path "kv/data/secrets/nodeapp" {
  capabilities = ["read"]
}
path "kv/metadata/secrets/nodeapp" {
  capabilities = ["read", "list"]
}
EOF
```

#### Create IAM Auth Role
```bash
vault write auth/aws/role/node-api \
    auth_type=iam \
    bound_iam_principal_arn="arn:aws:iam::ACCOUNT:role/AppRunnerInstanceRole" \
    policies=nodeapp-secrets \
    ttl=1h
```

#### Store Secrets
```bash
vault kv put kv/secrets/nodeapp \
    PORT=5000 \
    NODE_ENV=production \
    DB_HOST=mydb.rds.amazonaws.com \
    DB_PORT=3306 \
    DB_USER=admin \
    DB_PASSWORD=secure-password \
    DB_NAME=appdb \
    FRONTEND_URL=https://app.example.com
```

### 3.7 Step 6: GitHub Actions Setup

#### Create OIDC Provider
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

#### Create IAM Role for GitHub Actions
```bash
aws iam create-role \
  --role-name GitHubActionsRole \
  --assume-role-policy-document file://trust-policy.json

aws iam put-role-policy \
  --role-name GitHubActionsRole \
  --policy-name CICD \
  --policy-document file://permissions-policy.json
```

#### Add GitHub Secret
Add `AWS_ROLE_ARN` to GitHub repository secrets.

### 3.8 Step 7: App Runner Service Creation

```bash
aws apprunner create-service \
  --service-name backend-api \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/uday/backend:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "5000",
        "RuntimeEnvironmentVariables": {
          "VAULT_ADDR": "http://192.0.2.119:8200",
          "VAULT_ROLE": "node-api",
          "VAULT_SECRET_PATH": "kv/data/secrets/nodeapp"
        }
      }
    },
    "AutoDeploymentsEnabled": true
  }' \
  --instance-configuration '{
    "Cpu": "1024",
    "Memory": "2048",
    "InstanceRoleArn": "arn:aws:iam::ACCOUNT:role/AppRunnerInstanceRole"
  }' \
  --network-configuration '{
    "EgressConfiguration": {
      "EgressType": "VPC",
      "VpcConnectorArn": "arn:aws:apprunner:REGION:ACCOUNT:vpcconnector/vault-rds-connector/xxx"
    }
  }' \
  --health-check-configuration '{
    "Protocol": "HTTP",
    "Path": "/api/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  }'
```

### 3.9 Step 8: Deploy Application

```bash
# Push code to trigger deployment
git add .
git commit -m "Deploy backend API"
git push origin main

# Monitor deployment
aws apprunner list-operations --service-arn SERVICE_ARN
```

---

## 4. Security and Compliance

### 4.1 Identity and Access Management (IAM)

#### IAM Roles

| Role | Purpose | Permissions |
|------|---------|-------------|
| `AppRunnerInstanceRole` | App Runner container | ECR pull, Vault auth, CloudWatch logs |
| `GitHubActionsRole` | CI/CD pipeline | ECR push, App Runner deploy |
| `VaultServerRole` | Vault EC2 | STS for IAM auth validation |

#### IAM Policies

**App Runner Instance Role Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/apprunner/*"
    }
  ]
}
```

### 4.2 Network Security

| Layer | Control |
|-------|---------|
| VPC | Isolated network with public/private subnets |
| Security Groups | Least privilege access between components |
| VPC Connector | App Runner to private resources only |
| NAT Gateway | Controlled outbound internet access |

### 4.3 Secret Management

| Practice | Implementation |
|----------|----------------|
| No hardcoded secrets | All secrets in Vault |
| Dynamic credentials | Vault Agent fetches at runtime |
| Automatic rotation | PM2 restarts on secret change |
| Audit logging | Vault logs all secret access |
| Encryption at rest | Vault encrypts all secrets |

### 4.4 Container Security

| Practice | Implementation |
|----------|----------------|
| Non-root user | Container runs as `nodejs:1001` |
| Minimal base image | Alpine Linux |
| No SSH access | No shell access to containers |
| Health checks | Automatic restart on failure |

### 4.5 Data Security

| Data Type | Protection |
|-----------|------------|
| Data in transit | TLS 1.2+ (automatic HTTPS) |
| Data at rest | RDS encryption with AWS KMS |
| Secrets | Vault encryption |
| Logs | CloudWatch encryption |

### 4.6 Compliance Checklist

- [x] No static credentials in code
- [x] Encrypted data at rest and in transit
- [x] Least privilege IAM policies
- [x] Private network for database
- [x] Audit logging enabled
- [x] Automatic security patching (App Runner managed)

---

## 5. Operational Procedures

### 5.1 Monitoring

#### CloudWatch Metrics

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| CPU Utilization | > 80% for 5 min | Scale up or investigate |
| Memory Utilization | > 80% for 5 min | Scale up or investigate |
| Request Count | Trend analysis | Capacity planning |
| 5xx Errors | > 1% of requests | Investigate immediately |
| Latency (P99) | > 2 seconds | Performance investigation |

#### Health Check Endpoints

| Endpoint | Purpose | Frequency |
|----------|---------|-----------|
| `/api/health/live` | Liveness | Every 10 seconds |
| `/api/health/ready` | Readiness (DB check) | Every 30 seconds |
| `/api/health` | Full diagnostics | On-demand |

### 5.2 Logging

#### Log Locations

| Component | Location |
|-----------|----------|
| Application | CloudWatch: `/aws/apprunner/SERVICE/application` |
| App Runner System | CloudWatch: `/aws/apprunner/SERVICE/service` |
| Vault Audit | Vault server logs |

#### Log Retention

| Log Type | Retention |
|----------|-----------|
| Application logs | 30 days |
| System logs | 14 days |
| Audit logs | 90 days |

### 5.3 Scaling

#### Automatic Scaling Configuration

| Parameter | Value |
|-----------|-------|
| Min instances | 1 |
| Max instances | 10 |
| Max concurrency | 100 requests per instance |
| Scale-up trigger | Concurrent requests > 80% |
| Scale-down delay | 5 minutes of low traffic |

### 5.4 Deployment Procedures

#### Standard Deployment
```bash
git push origin main
# Automatic: Build → Push to ECR → Deploy to App Runner
# Duration: ~3 minutes
# Rollout: Zero-downtime (blue-green)
```

#### Rollback Procedure
```bash
# Option 1: Redeploy previous commit
git revert HEAD
git push origin main

# Option 2: Manual ECR image deployment
aws apprunner update-service \
  --service-arn SERVICE_ARN \
  --source-configuration ImageIdentifier=ACCOUNT.dkr.ecr.REGION.amazonaws.com/backend:previous-tag
```

### 5.5 Secret Rotation

```bash
# Update secret in Vault
vault kv put kv/secrets/nodeapp \
    DB_PASSWORD=new-secure-password \
    ... (other values)

# Vault Agent detects change within 1 minute
# PM2 automatically restarts with new credentials
# No deployment required
```

### 5.6 Disaster Recovery

| Component | Strategy | RTO | RPO |
|-----------|----------|-----|-----|
| App Runner | Automatic (ECR source) | < 5 min | 0 |
| RDS Database | Multi-AZ failover | < 5 min | 0 |
| RDS Backup | Daily automated snapshots | < 1 hour | 24 hours |
| Vault | Manual restore from backup | < 30 min | Depends on backup |
| ECR Images | Retained indefinitely | N/A | 0 |

#### Recovery Procedure

1. **App Runner failure**: Automatic recovery or manual redeploy
2. **RDS failure**: Automatic Multi-AZ failover
3. **Vault failure**: Restore from backup, update endpoints
4. **Complete region failure**: Deploy to secondary region from ECR

### 5.7 Maintenance Windows

| Activity | Frequency | Window |
|----------|-----------|--------|
| App Runner | None (automated) | N/A |
| RDS patching | Monthly | Sunday 02:00-04:00 UTC |
| Vault updates | Quarterly | Scheduled maintenance |

---

## 6. Cost Optimization

### 6.1 Cost Breakdown (Estimated Monthly)

| Service | Configuration | Est. Cost | Notes |
|---------|---------------|-----------|-------|
| **App Runner** | 1 vCPU, 2GB RAM | $40-60 | Pay per vCPU-hour + GB-hour |
| **Amazon ECR** | 5GB storage | $0.50 | Image storage |
| **VPC Connector** | Data transfer | $5-10 | Per GB transferred |
| **Amazon RDS** | db.t3.small, Multi-AZ | $50-70 | Reserved instances available |
| **NAT Gateway** | Data processing | $5-15 | Per GB processed |
| **CloudWatch** | Logs & metrics | $5-10 | Log ingestion & storage |
| **Vault (EC2)** | t3.small | $15-20 | Or use HCP Vault |
| **Route 53** | Hosted zone + queries | $1-2 | Per million queries |
| **Total** | | **$120-190** | Varies with traffic |

### 6.2 Cost Optimization Strategies

#### Implemented

| Strategy | Savings | Status |
|----------|---------|--------|
| **App Runner scaling to zero** | Pay only when active | ✅ Enabled |
| **Multi-stage Docker build** | Smaller image = faster deploy | ✅ Implemented |
| **CloudWatch log retention** | 30 days vs indefinite | ✅ Configured |

#### Recommended

| Strategy | Potential Savings | Effort |
|----------|-------------------|--------|
| **RDS Reserved Instance** | ~30-50% | Low |
| **HCP Vault (managed)** | Reduced ops overhead | Medium |
| **Spot instances for Vault** | ~70% on Vault EC2 | Medium |
| **Cost allocation tags** | Better visibility | Low |

### 6.3 Cost Monitoring

```bash
# Enable cost allocation tags
aws ce create-cost-category-definition \
  --name "Backend-API" \
  --rules '[{"Value": "backend-api", "Rule": {"Tags": {"Key": "Project", "Values": ["backend"]}}}]'
```

#### AWS Cost Explorer Filters
- Filter by service: App Runner, ECR, RDS
- Group by: Tag (Project: backend)
- Time range: Monthly comparison

### 6.4 Cost vs Previous Architecture

| Cost Category | EC2 + ASG | App Runner | Difference |
|---------------|-----------|------------|------------|
| Compute | ~$100 (2 x t3.medium) | ~$50 | -50% |
| Load Balancer | ~$20 (ALB) | Included | Included |
| Scaling overhead | Always-on minimum | Scale to zero | Lower |
| Operations | High (patching, updates) | Minimal | Significant |
| **Total** | ~$150-200 | ~$120-150 | -20-25% |

---

## Appendices

### Appendix A: File Structure

```
project/
├── .github/workflows/
│   └── backend.yml           # CI/CD pipeline
├── backend/
│   ├── vault/
│   │   ├── vault-agent-config.hcl
│   │   └── env.ctmpl
│   ├── config/
│   ├── controllers/
│   ├── routes/
│   ├── ecosystem.config.js   # PM2 configuration
│   ├── server.js             # Application entry
│   └── package.json
├── Dockerfile                # Container definition
├── docker-entrypoint.sh      # Startup script
├── .dockerignore
└── .gitignore
```

### Appendix B: Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `VAULT_ADDR` | App Runner config | Vault server URL |
| `VAULT_ROLE` | App Runner config | IAM auth role name |
| `VAULT_SECRET_PATH` | App Runner config | Secret path in Vault |
| `PORT` | Vault | Application port |
| `NODE_ENV` | Vault | Environment name |
| `DB_HOST` | Vault | Database endpoint |
| `DB_PORT` | Vault | Database port |
| `DB_USER` | Vault | Database username |
| `DB_PASSWORD` | Vault | Database password |
| `DB_NAME` | Vault | Database name |
| `FRONTEND_URL` | Vault | CORS origin |

### Appendix C: API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Full health status |
| `/api/health/live` | GET | Liveness probe |
| `/api/health/ready` | GET | Readiness probe |
| `/api/users` | GET | List users |
| `/api/users` | POST | Create user |
| `/api/users/:id` | GET | Get user |
| `/api/users/:id` | PUT | Update user |
| `/api/users/:id` | DELETE | Delete user |

---

*Document Version: 1.0 | Last Updated: December 2024*

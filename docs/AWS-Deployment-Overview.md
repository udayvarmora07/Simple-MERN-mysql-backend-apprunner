# AWS Production Deployment Guide

**Version:** 1.0 | **Date:** December 2024

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Architecture Components](#2-architecture-components)
3. [Setup Instructions](#3-setup-instructions)
4. [Deployment Flow](#4-deployment-flow)
5. [Security](#5-security)
6. [Reference](#6-reference)

---

## 1. Architecture Overview

![AWS Architecture Diagram](https://raw.githubusercontent.com/udayvarmora07/Simple-MERN-mysql-backend-apprunner/main/docs/architecture-diagram.png)

---

## 2. Architecture Components

### 2.1 Frontend (Static Hosting)

**What is Static Hosting?**
- Static hosting serves pre-built files (HTML, CSS, JavaScript) that don't change per request
- Unlike traditional servers, there's no backend processing for each page load
- This makes websites extremely fast and cost-effective

**Components:**
- **Route 53** → DNS service that resolves domain names (app.example.com)
- **CloudFront** → CDN for global content delivery with caching
- **S3 Bucket** → Stores React build files (HTML, CSS, JS)

**How it works:**
- User visits `app.example.com`
- Route 53 resolves the domain to CloudFront
- CloudFront serves cached content from the nearest edge location
- If content isn't cached, CloudFront fetches it from S3

**Benefits:**
- ✅ Global availability (200+ edge locations)
- ✅ Automatic HTTPS with free SSL certificates
- ✅ No servers to manage

---

### 2.2 Backend (Serverless Containers)

**What is Serverless?**
- Serverless means you don't manage servers
- AWS handles provisioning, scaling, patching, and maintenance
- You only provide your application code in a container

**Components:**
- **App Runner** → Runs Node.js backend containers
- **ECR** → Stores Docker images
- **VPC Connector** → Connects App Runner to private resources

**Benefits:**
- ✅ Zero infrastructure management
- ✅ Automatic scaling (0 to N instances)
- ✅ Zero-downtime deployments

---

### 2.3 Private Network (VPC)

**What is a VPC?**
- Virtual Private Cloud is your isolated network in AWS
- Resources in private subnets cannot be accessed from the internet
- Database and secrets are protected from direct internet access

**Components:**
- **VPC** → Isolated virtual network (10.0.0.0/16)
- **Public Subnet** → Contains NAT Gateway, Internet Gateway
- **Private Subnet** → Contains RDS, Vault (no internet access)
- **NAT Gateway** → Allows private subnet outbound internet
- **Internet Gateway** → Connects VPC to internet

---

### 2.4 Database & Secrets

- **RDS (MySQL)** → Managed database with Multi-AZ, automatic backups
- **HashiCorp Vault** → Dynamic secrets management, no hardcoded passwords

---

## 3. Setup Instructions

### 3.1 Create VPC

**Purpose:** Isolated network for your resources

**Steps:**
1. Go to AWS Console → VPC → Create VPC
2. Configure:
   - Name: `my-app-vpc`
   - CIDR: `10.0.0.0/16`
3. Click Create

**Create Subnets:**
- `public-1a` → 10.0.1.0/24 → ap-south-1a → Public
- `public-1b` → 10.0.2.0/24 → ap-south-1b → Public
- `private-1a` → 10.0.4.0/24 → ap-south-1a → Private
- `private-1b` → 10.0.5.0/24 → ap-south-1b → Private

**Create Internet Gateway:**
1. VPC → Internet Gateways → Create
2. Name: `my-app-igw`
3. Attach to VPC

**Create NAT Gateway:**
1. VPC → NAT Gateways → Create
2. Subnet: Select public subnet
3. Allocate Elastic IP

**Configure Route Tables:**

*Public Route Table:*
- 10.0.0.0/16 → local
- 0.0.0.0/0 → Internet Gateway

*Private Route Table:*
- 10.0.0.0/16 → local
- 0.0.0.0/0 → NAT Gateway

---

### 3.2 Create Security Groups

**Purpose:** Control network traffic between resources

**App Runner VPC Connector SG (`apprunner-connector-sg`):**
- Outbound: Port 3306 → RDS SG (MySQL)
- Outbound: Port 8200 → Vault SG (Vault)
- Outbound: Port 443 → 0.0.0.0/0 (AWS APIs)

**RDS Security Group (`rds-sg`):**
- Inbound: Port 3306 ← apprunner-connector-sg

**Vault Security Group (`vault-sg`):**
- Inbound: Port 8200 ← apprunner-connector-sg

---

### 3.3 Create RDS Database

**Purpose:** Managed MySQL database

**Steps:**
1. Go to AWS Console → RDS → Create Database
2. Configure:
   - Engine: MySQL 8.0
   - Template: Production
   - Instance: db.t3.small
   - Multi-AZ: Yes
   - VPC: my-app-vpc
   - Subnet group: Private subnets
   - Security group: rds-sg
   - Public access: No
   - Database name: appdb
3. Note the endpoint after creation

---

### 3.4 Create S3 Bucket (Frontend)

**Purpose:** Store React build files

**Steps:**
1. Go to AWS Console → S3 → Create Bucket
2. Configure:
   - Bucket name: `my-app-frontend` (globally unique)
   - Region: ap-south-1
   - Block public access: Yes
   - Versioning: Enabled

---

### 3.5 Create CloudFront Distribution

**Purpose:** CDN for fast global delivery

**Steps:**
1. Go to AWS Console → CloudFront → Create Distribution
2. Configure:
   - Origin domain: Select S3 bucket
   - Origin access: Origin Access Control (OAC)
   - Viewer protocol: Redirect HTTP to HTTPS
   - Default root object: index.html
3. Update S3 bucket policy to allow CloudFront access

---

### 3.6 Create ECR Repository

**Purpose:** Store Docker images

**Steps:**
1. Go to AWS Console → ECR → Create Repository
2. Configure:
   - Repository name: `my-app/backend`
   - Image scan: Enabled
   - Encryption: AES-256

---

### 3.7 Create VPC Connector

**Purpose:** Connect App Runner to private VPC

**Steps:**
1. Go to AWS Console → App Runner → VPC Connectors → Create
2. Configure:
   - Name: `vpc-connector`
   - VPC: my-app-vpc
   - Subnets: Private subnets
   - Security group: apprunner-connector-sg

---

### 3.8 Create App Runner Service

**Purpose:** Run backend containers

**Steps:**
1. Go to AWS Console → App Runner → Create Service
2. Configure:
   - Source: ECR
   - Repository: my-app/backend
   - Image tag: latest
   - Auto-deploy: Yes
   - CPU: 1 vCPU
   - Memory: 2 GB
   - Port: 5000

3. Environment variables:
   - VAULT_ADDR → http://VAULT_PRIVATE_IP:8200
   - VAULT_ROLE → node-api
   - VAULT_SECRET_PATH → kv/data/secrets/nodeapp

4. Networking: Select VPC Connector

5. Health check:
   - Path: `/api/health`
   - Interval: 10 seconds

---

### 3.9 Create Route 53 Records

**Purpose:** Map domain names to services

**Steps:**
1. Go to AWS Console → Route 53 → Hosted Zones
2. Select your domain
3. Create records:
   - app.example.com → A record → Alias to CloudFront
   - api.example.com → A record → Alias to App Runner

---

### 3.10 Setup HashiCorp Vault

**Purpose:** Manage secrets securely

**Steps:**
1. Launch EC2 in private subnet
2. Install Vault
3. Enable AWS auth
4. Create policy for application (read access to secrets)
5. Create IAM role binding
6. Store secrets (DB_HOST, DB_USER, DB_PASSWORD, etc.)

---

### 3.11 Setup GitHub Actions (CI/CD)

**Purpose:** Automate deployments

**Steps:**
1. Create IAM OIDC Provider for GitHub
2. Create IAM Role with trust to GitHub OIDC
3. Attach permissions (ECR, App Runner, S3, CloudFront)
4. Add GitHub Secret: `AWS_ROLE_ARN`
5. Create workflow files in `.github/workflows/`

---

## 4. Deployment Flow

### Frontend Deployment

```
Developer pushes code to frontend/ folder
                ↓
        GitHub Actions triggered
                ↓
        npm install → npm run build
                ↓
        Upload build files to S3
                ↓
        Invalidate CloudFront cache
                ↓
        New version live globally
```

### Backend Deployment

```
Developer pushes code to backend/ folder
                ↓
        GitHub Actions triggered
                ↓
        Docker build (create container image)
                ↓
        Push image to ECR
                ↓
        Trigger App Runner deployment
                ↓
        App Runner pulls new image
                ↓
        Zero-downtime deployment
                ↓
        New version live
```

### Secret Update Flow

```
Admin updates secret in Vault
                ↓
        Vault Agent detects change (every 1 minute)
                ↓
        New secrets written to environment
                ↓
        Application restarted with new credentials
                ↓
        No redeployment required
```

---

## 5. Security

### Security Layers

**Layer 1: Network Security**
- VPC isolates resources from internet
- Private subnets for database and secrets
- Security groups control traffic flow

**Layer 2: Identity & Access**
- AWS IAM for service-to-service authentication
- No static credentials in code
- OIDC for GitHub Actions (no stored AWS keys)

**Layer 3: Data Protection**
- All traffic encrypted with TLS (HTTPS)
- Database encrypted at rest (AES-256)
- Secrets encrypted in Vault

**Layer 4: Secrets Management**
- No hardcoded passwords
- Vault manages all credentials
- Automatic secret rotation support

### Security Checklist

- ✅ No hardcoded credentials
- ✅ HTTPS everywhere
- ✅ Database in private subnet
- ✅ Encryption at rest
- ✅ Least privilege access
- ✅ Audit logging enabled

---

## 6. Reference

### Key URLs

- **Frontend:** `https://app.example.com`
- **Backend API:** `https://api.example.com`
- **Health Check:** `https://api.example.com/api/health`

### Glossary

- **CDN** → Content Delivery Network
- **DNS** → Domain Name System
- **ECR** → Elastic Container Registry
- **IAM** → Identity and Access Management
- **VPC** → Virtual Private Cloud
- **Multi-AZ** → Multiple Availability Zones
- **TLS** → Transport Layer Security

---

*Last Updated: December 2024*

# AWS Production Deployment Guide

**Version:** 1.0 | **Date:** December 2024

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core AWS Services](#2-core-aws-services)
3. [Networking & Security](#3-networking--security)
4. [Static Content: S3 and CloudFront](#4-static-content-s3-and-cloudfront)
5. [Compute Layer: App Runner and ECR](#5-compute-layer-app-runner-and-ecr)
6. [Secrets Management: HashiCorp Vault](#6-secrets-management-hashicorp-vault)
7. [Database Layer: Amazon RDS](#7-database-layer-amazon-rds)
8. [DNS and Public Access](#8-dns-and-public-access)
9. [Deployment Flow](#9-deployment-flow)
10. [Reference](#10-reference)

---

## 1. Architecture Overview

![AWS Architecture Diagram](https://raw.githubusercontent.com/udayvarmora07/Simple-MERN-mysql-backend-apprunner/main/docs/architecture-diagram.png)

---

## 2. Core AWS Services

**Amazon CloudFront**
- Global content delivery network (CDN) for static assets
- Caches content at 200+ edge locations worldwide
- Provides low-latency access for users globally

**Amazon S3**
- Object storage service for hosting static web assets (front-end)
- Stores HTML, CSS, JavaScript, and images
- Highly durable (99.999999999% durability)

**Amazon VPC**
- Isolated virtual network with public and private subnets
- Provides network-level security and isolation
- Controls IP addressing, routing, and network gateways

**Internet Gateway**
- Enables inbound/outbound internet access for public subnets
- Allows resources in public subnets to communicate with internet
- Required for NAT Gateway to function

**NAT Gateway**
- Provides outbound internet access for private subnets
- Allows private resources to download updates and patches
- Prevents inbound connections from internet to private resources

**Amazon ECR**
- Private container registry for storing Docker images
- Integrated with AWS IAM for access control
- Supports image scanning for vulnerabilities

**AWS App Runner**
- Fully managed service to deploy containerized applications
- Automatic scaling, load balancing, and HTTPS
- No server management required

**Amazon RDS**
- Managed relational database service
- Deployed in private subnet for security
- Supports Multi-AZ for high availability

**Security Groups**
- Virtual firewall for controlling inbound/outbound traffic
- Applied at instance level
- Stateful - return traffic automatically allowed

---

## 3. Networking & Security

### Step 1 – Create the VPC and Subnets

**Create VPC:**
- Go to AWS Console → VPC → Create VPC
- Name: `app-vpc`
- CIDR: `10.0.0.0/16`

**Create Public Subnets (for NAT Gateway, Internet Gateway):**
- Public Subnet 1 → 10.0.1.0/24 → AZ A (ap-south-1a)
- Public Subnet 2 → 10.0.2.0/24 → AZ B (ap-south-1b)
- Public Subnet 3 → 10.0.3.0/24 → AZ C (ap-south-1c)

**Create Private Subnets (for RDS, Vault):**
- Private Subnet 1 → 10.0.4.0/24 → AZ A (ap-south-1a)
- Private Subnet 2 → 10.0.5.0/24 → AZ B (ap-south-1b)
- Private Subnet 3 → 10.0.6.0/24 → AZ C (ap-south-1c)

---

### Step 2 – Attach Internet Gateway and Configure Route Tables

**Create Internet Gateway:**
1. Go to VPC → Internet Gateways → Create Internet Gateway
2. Name: `app-igw`
3. Attach to VPC

**Create Public Route Table:**
1. Create route table: `public-rt`
2. Associate with public subnets
3. Add route: 0.0.0.0/0 → Internet Gateway

**Create Private Route Table:**
1. Create route table: `private-rt`
2. Associate with private subnets

---

### Step 3 – Create NAT Gateway for Private Subnets

1. Allocate an Elastic IP
2. Go to VPC → NAT Gateways → Create NAT Gateway
3. Select public subnet
4. Assign the Elastic IP
5. In private route table, add route: 0.0.0.0/0 → NAT Gateway

**Why NAT Gateway?**
- Private subnets need internet access for updates
- NAT allows outbound connections only
- Inbound connections from internet are blocked

---

### Step 4 – Define Security Groups

**RDS Database Security Group (`rds-sg`):**
- Purpose: Control access to database
- Inbound: Port 3306/5432 ← App Runner VPC Connector SG only
- Outbound: Default (VPC internal)

**App Runner VPC Connector Security Group (`apprunner-connector-sg`):**
- Purpose: Allow App Runner to access private resources
- Outbound: Port 3306/5432 → RDS SG
- Outbound: Port 8200 → Vault SG
- Outbound: Port 443 → 0.0.0.0/0 (AWS APIs)

**Vault Security Group (`vault-sg`):**
- Purpose: Control access to HashiCorp Vault
- Inbound: Port 8200 ← App Runner VPC Connector SG only

---

## 4. Static Content: S3 and CloudFront

### Step 5 – Create S3 Bucket for Static Files

1. Go to AWS Console → S3 → Create Bucket
2. Configure:
   - Bucket name: `app-frontend-bucket` (must be globally unique)
   - Region: ap-south-1
   - Block all public access: ✅ Enabled
   - Versioning: ✅ Enabled

3. Upload static files:
   - Build React app: `npm run build`
   - Upload `dist/` folder contents to bucket

4. Configure bucket policy to allow CloudFront access only

**Why Block Public Access?**
- CloudFront provides secure access via Origin Access Control (OAC)
- No direct public access to S3 bucket
- Better security and control

---

### Step 6 – Configure CloudFront Distribution

1. Go to AWS Console → CloudFront → Create Distribution
2. Configure Origin:
   - Origin domain: Select S3 bucket
   - Origin access: Origin Access Control (OAC)
   - Create new OAC if needed

3. Configure Default Behavior:
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD
   - Cache policy: CachingOptimized

4. Configure SSL Certificate:
   - Request certificate in ACM (us-east-1 region required for CloudFront)
   - Domain: app.example.com
   - Alternate domain name: app.example.com

5. Set Default Root Object: `index.html`

**Benefits of CloudFront:**
- Global edge locations for low latency
- Automatic HTTPS with free SSL
- DDoS protection built-in
- Caching reduces S3 costs

---

## 5. Compute Layer: App Runner and ECR

### Step 7 – Container Image in Amazon ECR

1. Go to AWS Console → ECR → Create Repository
2. Configure:
   - Repository name: `app/backend`
   - Image scan on push: ✅ Enabled
   - Encryption: AES-256

3. Build and push Docker image:
```
Developer builds Dockerfile
        ↓
Docker image created locally
        ↓
Authenticate to ECR
        ↓
Push image to ECR repository
        ↓
Image stored securely in AWS
```

4. Create IAM Role for App Runner (`AppRunnerEcrAccessRole`):
   - Permission: `ecr:GetAuthorizationToken`
   - Permission: `ecr:BatchGetImage`
   - Permission: `ecr:GetDownloadUrlForLayer`

---

### Step 8 – Deploy Backend on AWS App Runner

1. Go to AWS Console → App Runner → Create Service
2. Configure Source:
   - Source type: Container registry → Amazon ECR
   - Repository: Select your ECR repository
   - Image tag: latest (or specific version)
   - Deployment trigger: Automatic

3. Configure Runtime:
   - Port: 5000 (or your application port)
   - CPU: 1 vCPU
   - Memory: 2 GB

4. Configure Environment Variables:
   - VAULT_ADDR → http://VAULT_PRIVATE_IP:8200
   - VAULT_ROLE → node-api
   - VAULT_SECRET_PATH → kv/data/secrets/app
   - NODE_ENV → production

5. Configure Health Check:
   - Path: `/health`
   - Interval: 10 seconds
   - Timeout: 5 seconds

**App Runner Benefits:**
- No load balancer to configure
- No bastion host needed
- Automatic HTTPS
- Built-in logging to CloudWatch

---

### Step 9 – Scaling, Networking, and Security

**Auto-Scaling Configuration:**
- Minimum instances: 1 (or 2 for high availability)
- Maximum instances: 4 (adjust based on load)
- Scale based on: Concurrent requests or CPU utilization

**VPC Connector Setup:**
1. Go to App Runner → VPC Connectors → Create
2. Configure:
   - Name: `backend-vpc-connector`
   - VPC: Select your VPC
   - Subnets: Select private subnets
   - Security group: `apprunner-connector-sg`

3. Associate VPC Connector with App Runner service

**Why VPC Connector?**
- App Runner runs in AWS-managed VPC
- VPC Connector bridges to your private VPC
- Allows access to RDS and Vault in private subnets

**Security Benefits:**
- No SSH or Bastion host required
- Reduced attack surface
- All changes via container image updates
- IAM roles with least-privilege policies

---

## 6. Secrets Management: HashiCorp Vault

### Step 10 – Secrets Management with HashiCorp Vault

**Why Vault?**
- Single source of truth for sensitive data
- Database passwords, API keys, certificates
- Automatic secret rotation
- Audit logging for compliance

**Authentication Flow:**
```
App Runner container starts
        ↓
Application authenticates to Vault using AWS IAM
        ↓
Vault verifies IAM role is authorized
        ↓
Vault issues short-lived token
        ↓
Application reads secrets from Vault
        ↓
Secrets used for database/API connections
```

**Vault Configuration:**

1. Configure AWS Auth Method in Vault:
   - Enable AWS auth: `vault auth enable aws`
   - Bind App Runner IAM role to Vault policies

2. Create Vault Policy:
   - Path: `kv/data/secrets/app`
   - Capabilities: read

3. Store Secrets in Vault:
   - DB_HOST → RDS endpoint
   - DB_USER → database username
   - DB_PASSWORD → database password
   - API_KEYS → third-party API credentials

**Security Best Practices:**
- ✅ No secrets in code or configuration files
- ✅ No secrets in container images
- ✅ No secrets in environment variables
- ✅ Rotation managed centrally in Vault
- ✅ All access logged for audit

---

## 7. Database Layer: Amazon RDS

### Step 11 – Provision RDS Instance

1. Go to AWS Console → RDS → Create Database
2. Configure Engine:
   - Engine: MySQL 8.0 (or PostgreSQL)
   - Template: Production

3. Configure Settings:
   - DB instance identifier: `app-database`
   - Master username: `admin`
   - Master password: (store in Vault)

4. Configure Instance:
   - Instance class: db.t3.small (adjust for workload)
   - Storage: 20 GB (auto-scaling enabled)

5. Configure Availability:
   - Multi-AZ deployment: ✅ Yes (for production)
   - Creates standby in different AZ

6. Configure Connectivity:
   - VPC: Select your VPC
   - Subnet group: Private subnets
   - Public access: ❌ No
   - Security group: `rds-sg`

7. Configure Backup:
   - Backup retention: 7 days
   - Backup window: Preferred maintenance time

**Why Multi-AZ?**
- Automatic failover if primary fails
- Synchronous replication to standby
- Zero data loss during failover

---

### Step 12 – Connect Application to RDS

**Connection Flow:**
```
App Runner container
        ↓
VPC Connector
        ↓
Private Subnet
        ↓
RDS Security Group allows port 3306
        ↓
RDS Instance
```

**Application Configuration:**
- DB_HOST: Retrieved from Vault (RDS endpoint)
- DB_PORT: 3306 (MySQL) or 5432 (PostgreSQL)
- DB_USER: Retrieved from Vault
- DB_PASSWORD: Retrieved from Vault
- DB_NAME: Application database name

---

## 8. DNS and Public Access

### Step 13 – Configure Route 53

1. Go to AWS Console → Route 53 → Hosted Zones
2. Select your domain or create new hosted zone

**Create DNS Records:**

**Frontend (Static Content):**
- Record name: `app.example.com`
- Record type: A
- Alias: Yes
- Route traffic to: CloudFront distribution

**Backend API:**
- Record name: `api.example.com`
- Record type: A
- Alias: Yes
- Route traffic to: App Runner service URL

**Verification:**
- Wait for DNS propagation (may take minutes to hours)
- Test: `https://app.example.com` → Frontend loads
- Test: `https://api.example.com/health` → API responds

---

## 9. Deployment Flow

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
Vault Agent detects change
        ↓
New secrets written to environment
        ↓
Application restarted with new credentials
        ↓
No redeployment required
```

---

## 10. Reference

### Security Checklist

- ✅ No hardcoded credentials in code
- ✅ Database in private subnet (no public access)
- ✅ All traffic encrypted with TLS (HTTPS)
- ✅ Database encrypted at rest (AES-256)
- ✅ S3 bucket blocked from public access
- ✅ Security groups with least-privilege rules
- ✅ IAM roles with minimal permissions
- ✅ Vault audit logging enabled
- ✅ CloudWatch logging for all services

### Key URLs

- **Frontend:** `https://app.example.com`
- **Backend API:** `https://api.example.com`
- **Health Check:** `https://api.example.com/health`

### Glossary

- **CDN** → Content Delivery Network
- **DNS** → Domain Name System
- **ECR** → Elastic Container Registry
- **IAM** → Identity and Access Management
- **VPC** → Virtual Private Cloud
- **RDS** → Relational Database Service
- **Multi-AZ** → Multiple Availability Zones
- **NAT** → Network Address Translation
- **OAC** → Origin Access Control
- **TLS** → Transport Layer Security

---

*Last Updated: December 2024*

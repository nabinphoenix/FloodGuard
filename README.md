# FloodGuard

FloodGuard is a real-time flood early warning web application built for a cloud computing assignment. It combines public incident reporting, admin alert broadcasting, authority-managed sensor monitoring, AWS serverless processing, and live public alert feeds.

Repository: https://github.com/nabinphoenix/FloodGuard

## Features

- Public flood alert feed by district
- User registration and JWT authentication
- Flood incident reporting with optional S3 photo upload
- Community report feed with helpful votes
- Admin dashboard for report moderation, alert zones, users, and SNS broadcasts
- Authority sensor dashboard with DynamoDB-backed readings
- Sensor simulator for local/demo testing
- Lambda functions for alert broadcasting, automatic sensor alerts, and S3 report processing

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend API | Python 3.11, FastAPI, Uvicorn, Gunicorn |
| Frontend | React, Vite, Tailwind CSS |
| Relational Database | AWS RDS MySQL, SQLAlchemy, PyMySQL |
| NoSQL Sensor Store | AWS DynamoDB |
| File Storage | AWS S3 |
| Messaging | AWS SNS, AWS SQS |
| Serverless | AWS Lambda, API Gateway |
| Deployment | AWS Elastic Beanstalk, S3/static frontend hosting option |
| Monitoring | AWS CloudWatch custom metrics and logs |

## Folder Structure

```text
FloodGuard/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── requirements.txt
│   ├── Procfile
│   ├── seed.sql
│   ├── models/
│   ├── routers/
│   ├── schemas/
│   └── services/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── api/
│       ├── components/
│       └── pages/
├── lambda/
│   ├── broadcast_alert/
│   ├── auto_sensor_alert/
│   └── process_report/
├── sensor_simulator.py
├── setup.sh
└── README.md
```

## Environment Variables

Create `backend/.env` for local backend development:

```env
DATABASE_URL=mysql+pymysql://floodguard_user:strong_password@your-rds-endpoint.amazonaws.com:3306/floodguard
SECRET_KEY=replace-with-a-long-random-secret-key
AWS_ACCESS_KEY_ID=replace-with-your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=replace-with-your-aws-secret-access-key
AWS_REGION=ap-southeast-1
S3_BUCKET_NAME=floodguard-reports-bucket
SNS_TOPIC_ARN=arn:aws:sns:ap-southeast-1:123456789012:floodguard-alerts
SQS_SENSOR_QUEUE_URL=https://sqs.ap-southeast-1.amazonaws.com/123456789012/floodguard-sensor-queue
SQS_ADMIN_QUEUE_URL=https://sqs.ap-southeast-1.amazonaws.com/123456789012/floodguard-admin-queue
```

Create `frontend/.env` for local frontend development:

```env
VITE_API_URL=http://localhost:8000
```

For production, set `VITE_API_URL` to your deployed Elastic Beanstalk API URL, for example:

```env
VITE_API_URL=https://floodguard-prod.ap-southeast-1.elasticbeanstalk.com
```

## Local Setup

From the project root:

```bash
chmod +x setup.sh
./setup.sh
```

Or run the steps manually.

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` with your RDS and AWS values.

Run the FastAPI backend:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open:

```text
http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Database Setup

1. Create an AWS RDS MySQL database.
2. Create a database named `floodguard`.
3. Set `DATABASE_URL` in `backend/.env`.
4. Start the backend once so SQLAlchemy creates tables.
5. Run `backend/seed.sql` against the MySQL database to insert default sensors, zones, and users.

Seeded users:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@floodguard.com | Admin@123 |
| Authority | authority@floodguard.com | Auth@123 |

## Sensor Simulator

Start the backend first, then run:

```bash
python sensor_simulator.py http://localhost:8000
```

The simulator logs in as the seeded authority user and sends readings for:

- STN001 Klang River KL
- STN002 Gombak River Selangor
- STN003 Muar River Johor

## AWS Setup

Create these AWS resources:

- RDS MySQL database for relational data
- DynamoDB table named `SensorReadings`
  - Partition key: `station_id` string
  - Sort key: `timestamp` string
- S3 bucket for incident report photos
- SNS topic for flood alerts
- SQS queue for sensor messages
- SQS queue for admin review messages
- Lambda functions under `lambda/`
- Elastic Beanstalk Python 3.11 environment for the FastAPI backend
- CloudWatch logs and custom metrics

## AWS Architecture

FloodGuard uses Elastic Beanstalk to host the FastAPI backend. The React frontend calls the backend API using `VITE_API_URL`. User, report, alert zone, and station metadata are stored in AWS RDS MySQL through SQLAlchemy. Uploaded incident photos are stored in S3. Sensor readings are stored in DynamoDB for fast time-series access.

SNS is used for public alert broadcasts, while SQS decouples background workflows such as admin review notifications and sensor processing. Lambda functions handle serverless tasks: broadcasting alerts from API Gateway, triggering automatic alerts from SQS sensor readings, and processing new S3 report objects. CloudWatch stores logs and custom metrics for alert broadcasts, automatic sensor alerts, and processed reports.

## Elastic Beanstalk Backend Deployment

From the `backend/` folder:

```bash
eb init floodguard --platform "Python 3.11" --region ap-southeast-1
eb create floodguard-prod
eb setenv DATABASE_URL="mysql+pymysql://USER:PASSWORD@RDS-ENDPOINT:3306/floodguard" SECRET_KEY="CHANGE_ME" AWS_ACCESS_KEY_ID="CHANGE_ME" AWS_SECRET_ACCESS_KEY="CHANGE_ME" AWS_REGION="ap-southeast-1" S3_BUCKET_NAME="floodguard-reports-bucket" SNS_TOPIC_ARN="arn:aws:sns:ap-southeast-1:ACCOUNT_ID:floodguard-alerts" SQS_SENSOR_QUEUE_URL="https://sqs.ap-southeast-1.amazonaws.com/ACCOUNT_ID/floodguard-sensor-queue" SQS_ADMIN_QUEUE_URL="https://sqs.ap-southeast-1.amazonaws.com/ACCOUNT_ID/floodguard-admin-queue"
eb deploy
```

## Lambda Functions

The `lambda/` folder contains:

- `broadcast_alert`: API Gateway POST trigger, publishes alerts to SNS
- `auto_sensor_alert`: SQS trigger, publishes warning/emergency sensor alerts to SNS
- `process_report`: S3 object-created trigger, sends report photo review messages to SQS

## Team Members

| Member | Responsibility |
| --- | --- |
| Member 1 | Authentication and user profile |
| Member 2 | Incident reporting and community reports |
| Member 3 | Admin dashboard and alert broadcasting |
| Member 4 | Sensor monitoring and simulator |

## Useful Commands

Run backend:

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Run frontend:

```bash
cd frontend
npm run dev
```

Build frontend:

```bash
cd frontend
npm run build
```

Run simulator:

```bash
python sensor_simulator.py http://localhost:8000
```


# 🌊 FloodGuard — Complete Development Guide
## CT071-3-3-DDAC | Designing & Developing Cloud Applications
### From Zero to Deployed — Everything We Did Step by Step

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Assignment Requirements](#2-assignment-requirements)
3. [Why We Chose Flood Early Warning](#3-why-we-chose-flood-early-warning)
4. [Tech Stack Decision](#4-tech-stack-decision)
5. [AWS Services Used & Why](#5-aws-services-used--why)
6. [System Architecture](#6-system-architecture)
7. [Team Member Roles](#7-team-member-roles)
8. [Environment Setup](#8-environment-setup)
9. [AWS CLI Setup](#9-aws-cli-setup)
10. [AWS Services Creation](#10-aws-services-creation)
11. [Project Structure](#11-project-structure)
12. [Backend Development](#12-backend-development)
13. [Frontend Development](#13-frontend-development)
14. [Database Setup & Seeding](#14-database-setup--seeding)
15. [Fixes & Troubleshooting](#15-fixes--troubleshooting)
16. [Task 2 — Lambda & Serverless](#16-task-2--lambda--serverless)
17. [Deployment to Elastic Beanstalk](#17-deployment-to-elastic-beanstalk)
18. [CloudWatch & X-Ray Monitoring](#18-cloudwatch--x-ray-monitoring)
19. [Git Workflow](#19-git-workflow)
20. [Full Marks Strategy](#20-full-marks-strategy)

---

## 1. Project Overview

**Application Name:** FloodGuard
**Tagline:** Real-time Flood Intelligence. Powered by the Cloud. Built to Save Lives.
**Problem Statement:** Problem Background #4 — Flood Early Warning System
**GitHub Repository:** https://github.com/nabinphoenix/FloodGuard
**AWS Account ID:** `<AWS_ACCOUNT_ID>`
**AWS Region:** us-east-1

### What FloodGuard Does
- Monitors flood-prone areas using simulated water level sensor data
- Sends real-time email/SMS alerts to registered citizens when danger thresholds are hit
- Allows citizens to report flooding incidents with photos (uploaded to AWS S3)
- Gives administrators a dashboard to manage alerts and approve reports
- Gives flood authorities a live water level monitoring dashboard with charts
- Tracks system performance through AWS CloudWatch and X-Ray

---

## 2. Assignment Requirements

### Task 1 — 30 Marks (Due Week 11)
| Component | Marks | Type |
|-----------|-------|------|
| Group Video Demo (20 min max) | 15 | Group |
| Individual Video (5 min per member) | 15 | Individual |

**Requirements:**
- Frontend using HTML/CSS/JavaScript (we use React)
- At least one AWS cloud database (we use RDS MySQL + DynamoDB)
- Deploy to AWS Elastic Beanstalk or EC2 (we use Elastic Beanstalk)

### Task 2 — 20 Marks (Due Week 14)
| Component | Marks | Type |
|-----------|-------|------|
| System Implementation (Lambda + API Gateway + S3/SNS/SQS) | 10 | Group |
| Final Report (Word document, max 40 pages, 4000 words) | 10 | Group |

**Requirements:**
- Serverless architecture using AWS Lambda
- API Gateway endpoints
- At least one of: S3, SNS, or SQS
- CloudWatch and/or X-Ray monitoring
- Final Word document report

### Individual Requirements (Critical — 15 marks)
Each member must:
- Own at least 1 distinct user role
- Build at least 2 unique features
- Features must not overlap with other members
- Explain everything clearly in 5-minute individual video

---

## 3. Why We Chose Flood Early Warning

We chose **Problem Background #4 — Flood Early Warning** because:

1. **Cloud is mandatory, not optional** — Real-time sensor data MUST be processed instantly at scale. This proves we understand WHY cloud exists, not just how to use it.

2. **Every AWS service fits naturally:**
   - S3 → store flood report photos
   - SNS → send mass emergency alerts
   - SQS → buffer sensor readings
   - Lambda → auto-process alerts when threshold exceeded
   - DynamoDB → handle thousands of sensor writes per minute

3. **4 clear user roles** — perfect for 4 members with zero feature overlap:
   - Public Citizen
   - Incident Reporter
   - Admin
   - Flood Authority Officer

4. **Strong real-world impact** — lives at risk = serious problem = serious cloud solution

---

## 4. Tech Stack Decision

### Why FastAPI (not Flask or Django)
- Team already knows Python + FastAPI
- Auto-generates `/docs` page showing all API endpoints (impresses markers)
- Async support for handling multiple requests
- Pydantic validation built-in
- Works perfectly with boto3 AWS SDK

### Why React + Vite + Tailwind
- Team knows React
- Vite is faster than Create React App
- Tailwind CSS gives professional UI with minimal effort
- Component-based = each member owns their own pages

### Full Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Python + FastAPI | 3.13 / 0.111 |
| Frontend | React + Vite | 18 / 5.x |
| Styling | Tailwind CSS | 3.x |
| HTTP Client | Axios | 1.x |
| Charts | Chart.js + react-chartjs-2 | 4.x |
| Maps | Leaflet + react-leaflet | 4.x |
| Main Database | AWS RDS MySQL | 8.0 |
| Sensor Database | AWS DynamoDB | On-demand |
| File Storage | AWS S3 | - |
| Notifications | AWS SNS | - |
| Queue | AWS SQS | - |
| Serverless | AWS Lambda | Python 3.11 |
| API | Amazon API Gateway | REST |
| Deployment | AWS Elastic Beanstalk | Python 3.11 |
| Monitoring | AWS CloudWatch + X-Ray | - |
| Auth | JWT (python-jose) | HS256 |
| Password Hashing | bcrypt 4.0.1 (direct, no passlib) | 4.0.1 |
| Version Control | GitHub | - |

---

## 5. AWS Services Used & Why

### 1. Amazon RDS MySQL — Main Database
**Why:** Stores structured relational data — users, reports, alerts, zones, sensor stations. Data has relationships (report belongs to user, alert belongs to zone) so relational database is correct. AWS manages backups, patches, scaling automatically.

**Tables:**
```
users              → registered citizens, admins, authority officers
incident_reports   → flood reports submitted by citizens
alert_zones        → districts with current alert levels (safe/watch/warning/emergency)
flood_alerts       → history of every alert ever broadcast
sensor_stations    → registered water level monitoring stations
```

**Assignment requirement:** Task 1 — "must incorporate at least one AWS cloud database service"

---

### 2. Amazon DynamoDB — Sensor Readings Database
**Why:** Sensor simulator sends readings every 30 seconds × 3 stations = thousands of writes per day. RDS MySQL is too slow for this. DynamoDB handles millions of writes per second. Sensor readings have no complex relationships — simple key-value is perfect.

**Table:**
```
SensorReadings
  Partition Key: station_id (String)
  Sort Key:      timestamp  (String — ISO 8601)
  Attributes:    water_level, district
  Billing:       On-demand (pay per request)
```

**Assignment requirement:** Task 1 — second cloud database, shows appropriate service selection

---

### 3. Amazon S3 — File Storage
**Bucket:** `floodguard-uploads-g1`
**Why:** Citizens upload flood photos when reporting incidents. Files cannot be stored in a database efficiently. S3 stores any file type, infinitely scalable, gives public URL for display in the app. Also triggers Lambda automatically when photo is uploaded.

**How it works:**
```
Citizen uploads photo → FastAPI sends bytes to S3 → S3 returns public URL
→ URL saved in RDS incident_reports → displayed in community feed
```

**Assignment requirement:** Task 1 storage + Task 2 Lambda S3 trigger

---

### 4. Amazon SNS — Alert Broadcasting
**Topic ARN:** `arn:aws:sns:us-east-1:<AWS_ACCOUNT_ID>:floodguard-alerts`
**Subscribed email:** `<YOUR_EMAIL>` (confirmed)

**Why:** When admin broadcasts a flood alert, ALL registered users must be notified instantly. One SNS publish call sends email to every subscriber simultaneously. Supports email, SMS from one topic. Essential for real emergency alert system.

**How it works:**
```
Admin clicks Broadcast Alert → FastAPI/Lambda publishes to SNS topic
→ SNS sends email to all subscribers simultaneously
→ Users receive: "FLOOD ALERT [WARNING] - Kuala Lumpur: Water rising near Klang River"
```

**Assignment requirement:** Task 1 notification + Task 2 required service (SNS/SQS/S3)

---

### 5. Amazon SQS — Message Queue
**Queue 1:** `floodguard-sensor-queue` → sensor readings buffer
**Queue 2:** `floodguard-admin-queue` → admin report notifications

**Why:** If backend is busy when sensor sends a reading, the reading could be lost. SQS holds every message safely until processed — nothing is ever lost. Lambda reads from SQS in batches. Decouples sensor simulator from alert system — they work independently.

**How it works:**
```
Sensor simulator → sends reading to SQS (floodguard-sensor-queue)
→ Lambda reads batch from SQS automatically
→ checks water level vs threshold
→ if exceeded → publishes SNS emergency alert
```

**Assignment requirement:** Task 2 — required cloud service integration

---

### 6. AWS Elastic Beanstalk — App Deployment
**Why:** Upload zip file → Beanstalk handles everything (servers, load balancing, auto-restart). No need to manually manage EC2, install nginx, configure servers. Auto-scales with traffic. Gives public URL immediately.

**Procfile:**
```
web: gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

**Assignment requirement:** Task 1 — "must deploy to AWS using Elastic Beanstalk or EC2"

---

### 7. AWS Lambda — Serverless Functions (Task 2)
**Why:** Some tasks only need to run when something happens — not 24/7. Pay only when function runs. Auto-scales. Integrates natively with S3, SQS, API Gateway.

**Three Lambda functions:**
| Function | Trigger | What It Does |
|----------|---------|-------------|
| `floodguard-broadcast-alert` | API Gateway POST | Publishes to SNS, logs CloudWatch metric |
| `floodguard-auto-sensor-alert` | SQS queue | Checks water level threshold, auto-publishes SNS alert |
| `floodguard-process-report` | S3 object created | Sends SQS message to admin review queue |

**Assignment requirement:** Task 2 — "integrate serverless architecture components"

---

### 8. Amazon API Gateway — Lambda HTTP Endpoints
**Why:** Lambda functions have no URL by default. API Gateway gives them HTTP endpoints. Admin dashboard calls the broadcast endpoint which triggers Lambda without going through FastAPI.

**Assignment requirement:** Task 2 — "incorporating Amazon API Gateway and AWS Lambda"

---

### 9. AWS CloudWatch — Monitoring
**Dashboard name:** `FloodGuard-Monitoring`

**Why:** Track Lambda invocations, execution time, errors. Custom metrics track AlertsBroadcast and AutoAlertTriggered counts. CloudWatch alarms send email if error rate exceeds threshold. Required for Task 2 report screenshots.

**Metrics monitored:**
```
AWS/Lambda → Invocations    (how many times each Lambda ran)
AWS/Lambda → Duration       (how long each Lambda took in ms)
AWS/Lambda → Errors         (failed executions)
FloodGuard → AlertsBroadcast      (custom metric)
FloodGuard → AutoAlertTriggered   (custom metric)
```

**Assignment requirement:** Task 2 — "use AWS CloudWatch to observe system behaviour"

---

### 10. AWS X-Ray — Request Tracing
**Why:** Traces requests through entire system visually. Shows path: API Gateway → Lambda → SNS → DynamoDB. Identifies bottlenecks. Service map shows all connected components. Required for Task 2 report.

**Assignment requirement:** Task 2 — "AWS X-Ray to evaluate performance"

---

## 6. System Architecture

### Task 1 Architecture
```
[React Frontend - localhost:5173]
           |
           | HTTP/Axios
           ▼
[FastAPI Backend - Elastic Beanstalk :8000]
           |
    ┌──────┴──────┐
    ▼             ▼
[RDS MySQL]   [DynamoDB]
(users,       (SensorReadings -
reports,       high frequency)
alerts,
zones,
stations)
    |
    ▼
[S3 Bucket]
(flood photos)
    |
    ▼
[SNS Topic]
(email alerts)
```

### Task 2 Architecture (Enhanced)
```
[Sensor Simulator] → [SQS: sensor-queue] → [Lambda: auto-sensor-alert]
                                                      |
                                               checks threshold
                                                      |
                                               [SNS: mass alert]

[Admin Dashboard] → [API Gateway] → [Lambda: broadcast-alert]
                                            |
                                     [SNS: mass alert]
                                     [CloudWatch metric]

[Citizen uploads photo] → [S3] → [Lambda: process-report]
                                          |
                                   [SQS: admin-queue]

All Lambdas → [CloudWatch] + [X-Ray]
```

---

## 7. Team Member Roles

| Member | User Role | Features | AWS Services |
|--------|-----------|----------|-------------|
| Member 1 | Public Citizen | Registration, Login, JWT Auth, Public Alert Feed, Flood Map | RDS (users table) |
| Member 2 | Incident Reporter | Report Submission, S3 Photo Upload, Community Feed, My Reports | S3, SQS, RDS (reports) |
| Member 3 | Admin | Dashboard, Approve/Reject Reports, Broadcast Alerts via SNS, Zone Management | SNS, RDS (alerts, zones) |
| Member 4 | Flood Authority | Sensor Dashboard, Water Level Charts, DynamoDB, CloudWatch Monitoring | DynamoDB, SQS, CloudWatch, X-Ray |

---

## 8. Environment Setup

### Prerequisites Installed
```
Python 3.13
Node.js (latest LTS)
AWS CLI v2.34.49
Git
VS Code
```

### Python Virtual Environment
```powershell
cd "N:\6th Semester\Designing and Developing Applications on the Cloud (DDAC)\Assignment\FloodGuard\backend"

python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Setup
```powershell
cd "N:\6th Semester\Designing and Developing Applications on the Cloud (DDAC)\Assignment\FloodGuard\frontend"

npm install
npm install @vitejs/plugin-react
```

### Backend .env File
```env
DATABASE_URL=mysql+pymysql://admin:<DB_PASSWORD>@<RDS_ENDPOINT>/floodguard

SECRET_KEY=floodguard-super-secret-key-2025-ddac

AWS_ACCESS_KEY_ID=YOUR_KEY_FROM_VOCAREUM
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_FROM_VOCAREUM
AWS_SESSION_TOKEN=YOUR_TOKEN_FROM_VOCAREUM
AWS_REGION=us-east-1

S3_BUCKET_NAME=floodguard-uploads-g1
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:<AWS_ACCOUNT_ID>:floodguard-alerts
SQS_SENSOR_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/<AWS_ACCOUNT_ID>/floodguard-sensor-queue
SQS_ADMIN_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/<AWS_ACCOUNT_ID>/floodguard-admin-queue
```

> ⚠️ **AWS Academy Important:** Credentials expire every few hours. Re-paste from Vocareum → AWS Details → AWS CLI each session. Never commit .env to GitHub.

### Frontend .env File
```env
VITE_API_URL=http://localhost:8000
```

---

## 9. AWS CLI Setup

### Check AWS CLI Version
```powershell
aws --version
# aws-cli/2.34.49 Python/3.14.4 Windows/11 exe/AMD64
```

### Verify Connection
```powershell
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "<USER_ID>",
    "Account": "<AWS_ACCOUNT_ID>",
    "Arn": "arn:aws:sts::<AWS_ACCOUNT_ID>:assumed-role/voclabs/<VOCALABS_USER>"
}
```

### Set Region
```powershell
aws configure set region us-east-1
aws configure get region
# us-east-1
```

### Refresh Credentials (Do This Every Vocareum Session)
```powershell
notepad C:\Users\YourName\.aws\credentials
```
Paste the fresh credentials block from Vocareum → AWS Details → AWS CLI:
```
[default]
aws_access_key_id = ASIA...
aws_secret_access_key = xxxx...
aws_session_token = xxxx...
```

---

## 10. AWS Services Creation

### S3 Bucket
```powershell
# Create bucket
aws s3 mb s3://floodguard-uploads-g1 --region us-east-1

# Remove public access block
aws s3api put-public-access-block `
  --bucket floodguard-uploads-g1 `
  --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Create policy file
Set-Content -Path "bucket-policy.json" -Value '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::floodguard-uploads-g1/*"}]}'

# Apply policy
aws s3api put-bucket-policy --bucket floodguard-uploads-g1 --policy file://bucket-policy.json
```

### DynamoDB Table
```powershell
aws dynamodb create-table `
  --table-name SensorReadings `
  --attribute-definitions `
    AttributeName=station_id,AttributeType=S `
    AttributeName=timestamp,AttributeType=S `
  --key-schema `
    AttributeName=station_id,KeyType=HASH `
    AttributeName=timestamp,KeyType=RANGE `
  --billing-mode PAY_PER_REQUEST `
  --region us-east-1
```

### SNS Topic
```powershell
# Create topic
aws sns create-topic --name floodguard-alerts --region us-east-1
# Output: "TopicArn": "arn:aws:sns:us-east-1:<AWS_ACCOUNT_ID>:floodguard-alerts"

# Subscribe email
aws sns subscribe `
  --topic-arn arn:aws:sns:us-east-1:<AWS_ACCOUNT_ID>:floodguard-alerts `
  --protocol email `
  --notification-endpoint <YOUR_EMAIL> `
  --region us-east-1

# ✅ Check email and click Confirm Subscription
```

### SQS Queues
```powershell
aws sqs create-queue --queue-name floodguard-sensor-queue --region us-east-1
# Output: "QueueUrl": "https://sqs.us-east-1.amazonaws.com/<AWS_ACCOUNT_ID>/floodguard-sensor-queue"

aws sqs create-queue --queue-name floodguard-admin-queue --region us-east-1
# Output: "QueueUrl": "https://sqs.us-east-1.amazonaws.com/<AWS_ACCOUNT_ID>/floodguard-admin-queue"
```

### RDS MySQL
```powershell
aws rds create-db-instance `
  --db-instance-identifier floodguard-db `
  --db-instance-class db.t3.micro `
  --engine mysql `
  --engine-version 8.0 `
  --master-username admin `
  --master-user-password <DB_PASSWORD> `
  --allocated-storage 20 `
  --db-name floodguard `
  --publicly-accessible `
  --backup-retention-period 0 `
  --region us-east-1

# Wait 5-10 minutes then check status
aws rds describe-db-instances `
  --db-instance-identifier floodguard-db `
  --query "DBInstances[0].DBInstanceStatus" `
  --region us-east-1
# "available" means ready

# Get endpoint
aws rds describe-db-instances `
  --db-instance-identifier floodguard-db `
  --query "DBInstances[0].Endpoint.Address" `
  --region us-east-1
# "<RDS_ENDPOINT>"
```

### Open RDS Security Group
```powershell
# Get security group ID
aws rds describe-db-instances `
  --db-instance-identifier floodguard-db `
  --query "DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId" `
  --region us-east-1
# "<RDS_SECURITY_GROUP_ID>"

# Allow MySQL connections from anywhere
aws ec2 authorize-security-group-ingress `
  --group-id <RDS_SECURITY_GROUP_ID> `
  --protocol tcp `
  --port 3306 `
  --cidr 0.0.0.0/0 `
  --region us-east-1
```

### Verify All Services Created
```powershell
aws s3 ls
aws dynamodb list-tables --region us-east-1
aws sns list-topics --region us-east-1
aws sqs list-queues --region us-east-1
```

---

## 11. Project Structure

```
FloodGuard/
├── backend/                    ← FastAPI application
│   ├── main.py                 ← App entry point, registers all routers
│   ├── config.py               ← All settings + AWS config (pydantic-settings)
│   ├── database.py             ← SQLAlchemy engine + RDS MySQL connection
│   ├── requirements.txt        ← All Python packages
│   ├── Procfile                ← Elastic Beanstalk startup command
│   ├── .env                    ← Secret keys (NEVER commit to GitHub)
│   ├── .env.example            ← Template showing required keys
│   ├── seed.sql                ← SQL to seed initial data
│   ├── models/
│   │   ├── user.py             ← Member 1 — User model
│   │   ├── report.py           ← Member 2 — IncidentReport model
│   │   ├── alert.py            ← Member 3 — AlertZone + FloodAlert models
│   │   └── sensor.py           ← Member 4 — SensorStation model
│   ├── routers/
│   │   ├── auth.py             ← Member 1 — /auth/* routes
│   │   ├── public.py           ← Member 1 — /public/* routes
│   │   ├── reports.py          ← Member 2 — /reports/* routes
│   │   ├── admin.py            ← Member 3 — /admin/* routes
│   │   └── sensors.py          ← Member 4 — /sensors/* routes
│   ├── schemas/
│   │   ├── user.py             ← Pydantic request/response models
│   │   ├── report.py
│   │   ├── alert.py
│   │   └── sensor.py
│   └── services/
│       ├── s3_service.py       ← Member 2 — upload photos to S3
│       ├── sns_service.py      ← Member 3 — publish alerts to SNS
│       ├── sqs_service.py      ← Member 4 — send/receive SQS messages
│       └── dynamo_service.py   ← Member 4 — read/write DynamoDB
│
├── frontend/                   ← React application
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   ├── .env                    ← VITE_API_URL=http://localhost:8000
│   └── src/
│       ├── main.jsx            ← React entry point
│       ├── App.jsx             ← Router setup (all routes)
│       ├── api/                ← Axios API call functions
│       │   ├── axios.js        ← Base instance + JWT interceptor
│       │   ├── auth.js         ← Member 1
│       │   ├── reports.js      ← Member 2
│       │   ├── admin.js        ← Member 3
│       │   └── sensors.js      ← Member 4
│       ├── components/
│       │   ├── Navbar.jsx      ← Shared — role-aware navigation
│       │   ├── AlertBadge.jsx  ← Shared — colored status badge
│       │   ├── LoadingSpinner.jsx
│       │   └── ProtectedRoute.jsx ← JWT + role guard
│       └── pages/
│           ├── public/         ← Member 1
│           │   ├── Home.jsx
│           │   ├── Login.jsx
│           │   ├── Register.jsx
│           │   ├── AlertFeed.jsx
│           │   ├── FloodMap.jsx
│           │   └── Profile.jsx
│           ├── reports/        ← Member 2
│           │   ├── SubmitReport.jsx
│           │   ├── CommunityFeed.jsx
│           │   ├── MyReports.jsx
│           │   └── ReportDetail.jsx
│           ├── admin/          ← Member 3
│           │   ├── Dashboard.jsx
│           │   ├── ManageReports.jsx
│           │   ├── CreateAlert.jsx
│           │   ├── ManageZones.jsx
│           │   └── ManageUsers.jsx
│           └── sensors/        ← Member 4
│               ├── SensorDash.jsx
│               ├── WaterLevelChart.jsx
│               ├── SystemHealth.jsx
│               └── Thresholds.jsx
│
├── lambda/                     ← Task 2: Lambda function code
│   ├── broadcast_alert/
│   │   └── handler.py          ← Member 3
│   ├── auto_sensor_alert/
│   │   └── handler.py          ← Member 4
│   └── process_report/
│       └── handler.py          ← Member 2
│
├── sensor_simulator.py         ← Member 4 — sends fake sensor data
├── README.md
└── setup.sh
```

---

## 12. Backend Development

### Running the Backend
```powershell
cd "N:\...\FloodGuard\backend"
venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### API Endpoints Summary
```
AUTH
POST /auth/register     → Create new user, returns JWT token
POST /auth/login        → Login, returns JWT token
GET  /auth/me           → Get current user (requires JWT)
PUT  /auth/profile      → Update profile (requires JWT)
POST /auth/logout       → Logout

PUBLIC (no auth required)
GET /public/alerts              → All alert zones ordered by severity
GET /public/alerts/{district}   → Alert level for specific district
GET /public/alerts/history      → Last 20 flood alerts
GET /public/zones               → All zones with lat/lng for map
GET /public/stats               → Total counts

REPORTS (auth required)
POST /reports/submit            → Submit flood report with optional photo
GET  /reports/community         → Approved reports (public feed)
GET  /reports/my-reports        → Current user's reports
GET  /reports/{id}              → Single report detail
POST /reports/{id}/helpful      → Increment helpful count

ADMIN (admin role required)
GET  /admin/dashboard           → Stats overview
GET  /admin/reports             → All reports with filters
PUT  /admin/reports/{id}/approve → Approve report
PUT  /admin/reports/{id}/reject  → Reject with reason
GET  /admin/zones               → All alert zones
POST /admin/zones               → Create new zone
POST /admin/broadcast-alert     → Update zone + publish SNS
GET  /admin/users               → All users
PUT  /admin/users/{id}/role     → Change user role

SENSORS (authority role required except /live)
POST /sensors/reading           → Receive sensor reading, save to DynamoDB
GET  /sensors/live              → Latest reading all stations (public)
GET  /sensors/history/{id}      → 48 readings for chart
GET  /sensors/stations          → All stations from RDS
PUT  /sensors/stations/{id}/thresholds → Update thresholds
GET  /sensors/health            → System health status
```

### Procfile (Elastic Beanstalk)
```
web: gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

### requirements.txt
```
fastapi==0.111.0
uvicorn==0.30.1
gunicorn==22.0.0
sqlalchemy==2.0.30
pymysql==1.1.1
boto3==1.34.120
pydantic==2.7.1
pydantic-settings==2.3.0
python-jose[cryptography]==3.3.0
bcrypt==4.0.1
python-multipart==0.0.9
python-dotenv==1.0.1
cryptography==41.0.7
```

---

## 13. Frontend Development

### Running the Frontend
```powershell
cd "N:\...\FloodGuard\frontend"
npm run dev
# Runs at http://localhost:5173
```

### Building for Production
```powershell
npm run build
# Creates dist/ folder — these static files deploy with the backend
```

### vite.config.js (Fixed Version)
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

### Pages by Member
| Member | Pages |
|--------|-------|
| Member 1 | Home, Login, Register, Profile, AlertFeed, FloodMap |
| Member 2 | SubmitReport, CommunityFeed, MyReports, ReportDetail |
| Member 3 | Admin Dashboard, ManageReports, CreateAlert, ManageZones, ManageUsers |
| Member 4 | SensorDash, WaterLevelChart, SystemHealth, Thresholds |

---

## 14. Database Setup & Seeding

### Create All Tables
```powershell
python -c "
from database import engine, Base
from models import user, report, alert, sensor
Base.metadata.create_all(bind=engine)
print('All tables created successfully!')
"
```

### Seed Initial Data
```powershell
python -c "
from database import SessionLocal
from models.user import User
from models.report import IncidentReport
from models.alert import AlertZone, FloodAlert
from models.sensor import SensorStation
import bcrypt as _bcrypt

db = SessionLocal()

def hash_pw(p):
    return _bcrypt.hashpw(p.encode(), _bcrypt.gensalt()).decode()

# Admin user
db.add(User(name='Admin User', email='admin@floodguard.com', phone='0123456789', district='Kuala Lumpur', password_hash=hash_pw('Admin@123'), role='admin'))

# Authority user
db.add(User(name='Authority Officer', email='authority@floodguard.com', phone='0123456788', district='Selangor', password_hash=hash_pw('Auth@123'), role='authority'))

# Alert zones
for z in [
    AlertZone(district='Kuala Lumpur', alert_level='warning', latitude=3.1390, longitude=101.6869),
    AlertZone(district='Selangor', alert_level='safe', latitude=3.0738, longitude=101.5183),
    AlertZone(district='Johor', alert_level='emergency', latitude=1.9344, longitude=103.3587),
    AlertZone(district='Kelantan', alert_level='watch', latitude=6.1254, longitude=102.2386),
]:
    db.add(z)

# Sensor stations
for s in [
    SensorStation(id='STN001', name='Klang River - KL', district='Kuala Lumpur', latitude=3.1390, longitude=101.6869, warning_threshold=3.5, danger_threshold=5.0, is_active=True),
    SensorStation(id='STN002', name='Gombak River', district='Selangor', latitude=3.2048, longitude=101.5529, warning_threshold=2.8, danger_threshold=4.2, is_active=True),
    SensorStation(id='STN003', name='Muar River', district='Johor', latitude=2.0442, longitude=102.5689, warning_threshold=4.0, danger_threshold=6.0, is_active=True),
]:
    db.add(s)

db.commit()
db.close()
print('Database seeded successfully!')
"
```

### Seeded Users
| Email | Password | Role |
|-------|----------|------|
| admin@floodguard.com | Admin@123 | admin |
| authority@floodguard.com | Auth@123 | authority |
| test@gmail.com | Test@123 | public (registered via API) |

### Seeded Alert Zones
| District | Alert Level |
|----------|-------------|
| Kuala Lumpur | warning |
| Selangor | safe |
| Johor | emergency |
| Kelantan | watch |

---

## 15. Fixes & Troubleshooting

### Fix 1 — pymysql Not Installed
**Error:** `ModuleNotFoundError: No module named 'pymysql'`
```powershell
pip install pymysql cryptography
```

### Fix 2 — vite.config.js Empty
**Error:** `Error: config must export or return an object`
```powershell
Set-Content -Path "vite.config.js" -Value @"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], server: { port: 5173 } })
"@
npm install @vitejs/plugin-react
```

### Fix 3 — bcrypt/passlib Incompatibility with Python 3.13
**Error:** `module 'bcrypt' has no attribute '__about__'` and `ValueError: password cannot be longer than 72 bytes`

**Root cause:** passlib 1.7.4 is incompatible with bcrypt 4.x and Python 3.13.

**Fix:** Remove passlib entirely. Use bcrypt directly.
```powershell
pip uninstall bcrypt passlib -y
pip install bcrypt==4.0.1
```

In `routers/auth.py`, replace all passlib code with:
```python
import bcrypt as _bcrypt

def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode('utf-8'), _bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
```

### Fix 4 — SQLAlchemy IncidentReport KeyError During Seed
**Error:** `KeyError: 'IncidentReport'` when creating User objects

**Root cause:** SQLAlchemy needs all related models imported before creating instances.

**Fix:** Import ALL models before creating any instances:
```python
from models.user import User
from models.report import IncidentReport  # ← must import this too
from models.alert import AlertZone, FloodAlert
from models.sensor import SensorStation
```

### Fix 5 — S3 Bucket Policy JSON Error in PowerShell
**Error:** `Unknown options: Version\:\2012-10-17...`

**Root cause:** PowerShell mangles inline JSON with backslashes.

**Fix:** Write JSON to a file first, then reference the file:
```powershell
Set-Content -Path "bucket-policy.json" -Value '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::floodguard-uploads-g1/*"}]}'
aws s3api put-bucket-policy --bucket floodguard-uploads-g1 --policy file://bucket-policy.json
```

### Fix 6 — WatchFiles Reloading venv Packages
**Issue:** uvicorn keeps reloading when packages are installed because it watches the venv folder.

**Fix:** Restart uvicorn after installing packages. Or use `--reload-exclude venv`:
```powershell
uvicorn main:app --reload --reload-exclude venv --host 0.0.0.0 --port 8000
```

---

## 16. Task 2 — Lambda & Serverless

### Lambda 1 — broadcast_alert (Member 3)
**Trigger:** API Gateway POST /broadcast-alert
**File:** `lambda/broadcast_alert/handler.py`

```python
import boto3, json, os

sns = boto3.client('sns')
cw  = boto3.client('cloudwatch')

def lambda_handler(event, context):
    body = json.loads(event.get('body', '{}'))
    district    = body['district']
    alert_level = body['alert_level']
    message     = body['message']

    result = sns.publish(
        TopicArn=os.environ['SNS_TOPIC_ARN'],
        Subject=f'FloodGuard [{alert_level.upper()}] — {district}',
        Message=f'FLOOD ALERT\nArea: {district}\nLevel: {alert_level.upper()}\n{message}'
    )

    cw.put_metric_data(Namespace='FloodGuard', MetricData=[{
        'MetricName': 'AlertsBroadcast', 'Value': 1, 'Unit': 'Count',
        'Dimensions': [{'Name': 'AlertLevel', 'Value': alert_level}]
    }])

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'message_id': result['MessageId']})
    }
```

**Environment Variables:**
```
SNS_TOPIC_ARN = arn:aws:sns:us-east-1:<AWS_ACCOUNT_ID>:floodguard-alerts
```

**IAM Policy:**
```json
{
  "Effect": "Allow",
  "Action": ["sns:Publish", "cloudwatch:PutMetricData"],
  "Resource": "*"
}
```

---

### Lambda 2 — auto_sensor_alert (Member 4)
**Trigger:** SQS — floodguard-sensor-queue (batch size 10)
**File:** `lambda/auto_sensor_alert/handler.py`

```python
import boto3, json, os

sns = boto3.client('sns')
cw  = boto3.client('cloudwatch')

def lambda_handler(event, context):
    triggered = 0
    for record in event['Records']:
        reading = json.loads(record['body'])
        level   = float(reading['water_level'])
        danger  = float(reading['danger_threshold'])
        warn    = float(reading['warning_threshold'])

        if level >= danger:
            alert_level = 'EMERGENCY'
        elif level >= warn:
            alert_level = 'WARNING'
        else:
            continue

        sns.publish(
            TopicArn=os.environ['SNS_TOPIC_ARN'],
            Subject=f'AUTO ALERT [{alert_level}] — {reading["district"]}',
            Message=f'AUTOMATIC FLOOD DETECTION\nStation: {reading["name"]}\nWater Level: {level:.2f}m\nStatus: {alert_level}'
        )
        triggered += 1

    cw.put_metric_data(Namespace='FloodGuard', MetricData=[{
        'MetricName': 'AutoAlertTriggered', 'Value': triggered, 'Unit': 'Count'
    }])
    return {'statusCode': 200, 'triggered': triggered}
```

**Environment Variables:**
```
SNS_TOPIC_ARN = arn:aws:sns:us-east-1:<AWS_ACCOUNT_ID>:floodguard-alerts
```

**IAM Policy:**
```json
{
  "Effect": "Allow",
  "Action": ["sns:Publish", "cloudwatch:PutMetricData", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
  "Resource": "*"
}
```

---

### Lambda 3 — process_report (Member 2)
**Trigger:** S3 — floodguard-uploads-g1 — All object create events
**File:** `lambda/process_report/handler.py`

```python
import boto3, json, os

sqs = boto3.client('sqs')
cw  = boto3.client('cloudwatch')

def lambda_handler(event, context):
    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        key    = record['s3']['object']['key']
        s3_url = f'https://{bucket}.s3.amazonaws.com/{key}'

        sqs.send_message(
            QueueUrl=os.environ['ADMIN_REVIEW_QUEUE_URL'],
            MessageBody=json.dumps({'s3_url': s3_url, 'key': key, 'source': 'citizen_upload'})
        )

    cw.put_metric_data(Namespace='FloodGuard', MetricData=[{
        'MetricName': 'ReportsProcessed', 'Value': len(event['Records']), 'Unit': 'Count'
    }])
    return {'statusCode': 200}
```

**Environment Variables:**
```
ADMIN_REVIEW_QUEUE_URL = https://sqs.us-east-1.amazonaws.com/<AWS_ACCOUNT_ID>/floodguard-admin-queue
```

**IAM Policy:**
```json
{
  "Effect": "Allow",
  "Action": ["sqs:SendMessage", "cloudwatch:PutMetricData"],
  "Resource": "*"
}
```

### Deploy Lambda to AWS Console
```
1. AWS Console → Lambda → Create Function
2. Author from scratch
3. Runtime: Python 3.11
4. Paste handler.py code into inline editor
5. Add environment variables under Configuration → Environment Variables
6. Add trigger (API Gateway / SQS / S3)
7. Attach IAM policies under Configuration → Permissions
8. Enable X-Ray: Configuration → Monitoring → Active Tracing → Enable
9. Test using the test event JSON provided
```

### Test Events
**broadcast_alert:**
```json
{
  "body": "{\"district\":\"Kuala Lumpur\",\"alert_level\":\"warning\",\"message\":\"Water level rising near Klang River.\"}",
  "isBase64Encoded": false
}
```

**auto_sensor_alert:**
```json
{
  "Records": [{
    "messageId": "msg-001",
    "body": "{\"station_id\":\"STN001\",\"name\":\"Klang River KL\",\"district\":\"Kuala Lumpur\",\"water_level\":4.8,\"warning_threshold\":3.5,\"danger_threshold\":4.5,\"timestamp\":\"2026-06-29T12:00:00Z\"}"
  }]
}
```

**process_report:**
```json
{
  "Records": [{
    "s3": {
      "bucket": {"name": "floodguard-uploads-g1"},
      "object": {"key": "incident-reports/sample-photo.jpg"}
    }
  }]
}
```

---

## 17. Deployment to Elastic Beanstalk

### Install EB CLI
```powershell
pip install awsebcli
```

### Initialize and Deploy
```powershell
cd "N:\...\FloodGuard\backend"

# Initialize
eb init floodguard --platform python-3.11 --region us-east-1

# Create environment
eb create floodguard-prod

# Set environment variables (all keys from .env)
eb setenv DATABASE_URL="mysql+pymysql://..." SECRET_KEY="..." AWS_ACCESS_KEY_ID="..." AWS_SECRET_ACCESS_KEY="..." AWS_SESSION_TOKEN="..." AWS_REGION="us-east-1" S3_BUCKET_NAME="floodguard-uploads-g1" SNS_TOPIC_ARN="arn:aws:sns:us-east-1:<AWS_ACCOUNT_ID>:floodguard-alerts" SQS_SENSOR_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/<AWS_ACCOUNT_ID>/floodguard-sensor-queue" SQS_ADMIN_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/<AWS_ACCOUNT_ID>/floodguard-admin-queue"

# Deploy
eb deploy

# Open live URL
eb open
```

### Build and Include React Frontend
```powershell
cd "N:\...\FloodGuard\frontend"
npm run build
# Copy dist/ folder into backend/ folder before zipping
```

---

## 18. CloudWatch & X-Ray Monitoring

### Create CloudWatch Dashboard
```
AWS Console → CloudWatch → Dashboards → Create dashboard
Name: FloodGuard-Monitoring
```

Add these widgets:
```
Widget 1: Lambda Invocations (all 3 functions, Sum, 5 min period)
Widget 2: Lambda Errors (all 3 functions, Sum)
Widget 3: Lambda Duration (all 3 functions, Average)
Widget 4: Custom metric FloodGuard/AlertsBroadcast (Sum)
Widget 5: Custom metric FloodGuard/AutoAlertTriggered (Sum)
```

### Create CloudWatch Alarm
```
CloudWatch → Alarms → Create alarm
Metric: AWS/Lambda → Errors → floodguard-broadcast-alert
Condition: Sum > 0 in 1 minute
Action: Send to SNS topic floodguard-alerts
Alarm name: FloodGuard-Lambda-Errors
```

### Enable X-Ray
For each Lambda function:
```
Lambda → Function → Configuration → Monitoring and operations tools → Edit
Enable Active Tracing → Save
Also attach AWSXRayDaemonWriteAccess to IAM role
```

### Screenshots Needed for Report
```
1.  Lambda functions list (all 3 visible)
2.  broadcast_alert showing API Gateway trigger
3.  auto_sensor_alert showing SQS trigger
4.  process_report showing S3 trigger
5.  Environment variables page for each Lambda
6.  IAM role permissions showing SNS/SQS/CloudWatch/X-Ray
7.  CloudWatch dashboard with all 5 widgets showing real data
8.  Custom metric AlertsBroadcast with data
9.  Custom metric AutoAlertTriggered with data
10. CloudWatch alarm in OK or In Alarm state
11. X-Ray active tracing enabled on each Lambda
12. X-Ray service map showing Lambda nodes
13. X-Ray trace detail showing invocation timeline
```

> ⚠️ **Important:** Trigger each Lambda at least 15-20 times BEFORE taking CloudWatch screenshots. Empty graphs will cost marks.

---

## 19. Git Workflow

### Initial Setup
```powershell
cd "N:\...\Assignment\FloodGuard"
git init
git remote add origin https://github.com/nabinphoenix/FloodGuard
git fetch origin
git merge origin/main --allow-unrelated-histories
```

### Branch Structure
```
main                      ← always working, deployed
dev                       ← integration branch
feature/member1-auth      ← Member 1's branch
feature/member2-reports   ← Member 2's branch
feature/member3-admin     ← Member 3's branch
feature/member4-sensors   ← Member 4's branch
```

### Daily Workflow for Each Member
```powershell
# Start work
git checkout feature/member1-auth
git pull origin dev

# After completing a feature
git add .
git commit -m "Add: user registration and JWT auth"
git push origin feature/member1-auth
# Tell team lead to merge into dev
```

### Team Lead Merging
```powershell
git checkout dev
git merge feature/member2-reports
git push origin dev

# When everything works on dev
git checkout main
git merge dev
git push origin main
eb deploy
```

### Commit After Each Milestone
```powershell
# After Task 1 complete
git add -A
git commit -m "Task 1 complete - FloodGuard fully working on Elastic Beanstalk"
git push origin main
git tag -a v1.0-task1 -m "Task 1 submission"
git push origin v1.0-task1

# After Task 2 complete
git add -A
git commit -m "Task 2 complete - Lambda serverless + CloudWatch monitoring"
git push origin main
git tag -a v2.0-task2 -m "Task 2 submission"
git push origin v2.0-task2
```

---

## 20. Full Marks Strategy

### Task 1 Group Video (15 marks) — Distinction Checklist
- [ ] App is LIVE on Elastic Beanstalk with real public URL — not localhost
- [ ] Show RDS instance in AWS Console during video
- [ ] S3 photo upload works — upload real photo, show it in S3 bucket AND displayed in app
- [ ] SNS alert sends real email — show inbox receiving notification in video
- [ ] Demo all 4 user roles: public citizen → reporter → admin → authority
- [ ] UI is professional — consistent colors, mobile responsive
- [ ] Passwords hashed, JWT protected routes, role-based access enforced
- [ ] No bugs or crashes during demo

### Task 1 Individual Video (15 marks) — What to Say
```
Minute 1: Show your name in workload matrix. Explain your user role.
Minute 2: Open VS Code. Show YOUR specific files — models, routes, services, pages.
Minute 3: Explain WHY you made decisions. "I used DynamoDB for sensors because RDS
          can't handle thousands of writes per minute at sensor frequency..."
Minute 4: Show your features WORKING in the live deployed app.
Minute 5: Mention one specific challenge and how you solved it.

Key rule: Show your CODE on screen while talking. Never just click through the UI.
```

### Task 2 Implementation (10 marks) — Distinction Checklist
- [ ] All 3 Lambda functions deployed and WORKING — test live during demo
- [ ] API Gateway endpoint is real — show URL in Postman returning response
- [ ] SQS has real messages — show SQS console with messages visible
- [ ] SNS sends real emails from Lambda — show inbox during demo
- [ ] Each Lambda does ONE thing — proper microservices design
- [ ] Architecture diagram uses official AWS icons (draw.io AWS icon pack)

### Task 2 Final Report (10 marks) — Distinction Checklist
- [ ] Task 1 AND Task 2 architecture diagrams — show what changed
- [ ] CloudWatch screenshots have REAL data — trigger Lambdas 20+ times first
- [ ] X-Ray screenshots show real traces
- [ ] Performance analysis discusses actual numbers: "Average Lambda duration was 234ms"
- [ ] Each reflection is 200+ words with specific challenges and specific solutions
- [ ] Workload matrix lists every feature, every AWS service, every member

### Things That Drop Marks
- ❌ Showing localhost URL in demo (app must be on Beanstalk)
- ❌ Local database instead of RDS MySQL
- ❌ Empty CloudWatch graphs — generate real traffic first
- ❌ Individual video only shows the UI — must show the CODE
- ❌ Vague reflections like "I learned a lot"
- ❌ Two members owning the same feature
- ❌ Architecture diagram with generic boxes — use AWS service icons

---

## Quick Reference — AWS Resources Created

| Resource | Name/ID | Value |
|----------|---------|-------|
| AWS Account | - | `<AWS_ACCOUNT_ID>` |
| AWS Region | - | us-east-1 |
| S3 Bucket | floodguard-uploads-g1 | Public read enabled |
| DynamoDB Table | SensorReadings | On-demand billing |
| SNS Topic | floodguard-alerts | arn:aws:sns:us-east-1:<AWS_ACCOUNT_ID>:floodguard-alerts |
| SNS Subscription | `<YOUR_EMAIL>` | Confirmed |
| SQS Queue 1 | floodguard-sensor-queue | https://sqs.us-east-1.amazonaws.com/<AWS_ACCOUNT_ID>/floodguard-sensor-queue |
| SQS Queue 2 | floodguard-admin-queue | https://sqs.us-east-1.amazonaws.com/<AWS_ACCOUNT_ID>/floodguard-admin-queue |
| RDS Instance | floodguard-db | `<RDS_ENDPOINT>` |
| RDS Security Group | `<RDS_SECURITY_GROUP_ID>` | Port 3306 configured for allowed client IPs |
| GitHub Repo | FloodGuard | https://github.com/nabinphoenix/FloodGuard |

---

## Quick Reference — Running the App Locally

### Terminal 1 — Backend
```powershell
cd "N:\6th Semester\Designing and Developing Applications on the Cloud (DDAC)\Assignment\FloodGuard\backend"
venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 2 — Frontend
```powershell
cd "N:\6th Semester\Designing and Developing Applications on the Cloud (DDAC)\Assignment\FloodGuard\frontend"
npm run dev
```

### Terminal 3 — Sensor Simulator (Member 4)
```powershell
cd "N:\6th Semester\Designing and Developing Applications on the Cloud (DDAC)\Assignment\FloodGuard"
venv\Scripts\activate  (or cd backend && venv\Scripts\activate)
python sensor_simulator.py http://localhost:8000
```

### Access Points
| URL | What It Shows |
|-----|--------------|
| http://localhost:5173 | React frontend (homepage) |
| http://localhost:5173/login | Login page |
| http://localhost:5173/register | Register page |
| http://localhost:5173/admin | Admin dashboard |
| http://localhost:5173/sensors | Sensor dashboard |
| http://localhost:8000/docs | FastAPI auto-generated API docs |
| http://localhost:8000/public/stats | Live stats JSON |

---

*Last updated: June 2026 | FloodGuard v1.0 | CT071-3-3-DDAC Group Project*

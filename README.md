# FloodGuard

FloodGuard is a cloud-based flood monitoring, citizen reporting, sensor monitoring, and early-warning platform developed for the **Designing and Developing Applications on the Cloud (DDAC)** group assignment.

The system combines a React/Vite frontend, FastAPI backend, relational flood and sensor data, role-based dashboards, serverless processing, event-driven AWS services, automated alerts, image optimization, secure private networking, CI/CD, and cloud monitoring.

---

## Live Application

**Production Website:**  
https://sunitanepali.com.np/

**GitHub Repository:**  
https://github.com/nabinphoenix/FloodGuard

> The production deployment is hosted on AWS. Availability may depend on the academic AWS environment remaining active.

---

## Submitted By

**A3_Group7**

| Name                | APU Number |
| ------------------- | ---------- |
| Nabin Nepali        | NP069707   |
| Rajesh Sapkota      | NP069734   |
| Ayushree Lamichhane | NP069661   |
| Prinsa Khadgi       | NP069734   |

---

## Team Responsibilities

| Member                  | Primary Role          | Major Responsibilities                                                                                                                                                                             |
| ----------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nabin Nepali**        | Administrator         | Administrator functionality, Amazon SQS, SQS Dead-Letter Queue, AWS Elastic Beanstalk, Broadcast Alert Lambda, GitHub Actions CI/CD, domain/HTTPS integration, documentation, project coordination |
| **Rajesh Sapkota**      | Field Officer         | Field Officer functionality, Amazon RDS MySQL, Sensor Simulator Lambda, sensor workflows, per-user SNS password-recovery implementation                                                            |
| **Ayushree Lamichhane** | Citizen / Public User | Citizen/Public functionality, Amazon S3, AWS CloudWatch, Optimize Report Image Lambda, citizen incident image workflow                                                                             |
| **Prinsa Khadgi**       | Authority             | Authority functionality, Amazon SNS, custom VPC/networking, Auto Sensor Alert Lambda, alert-processing workflows                                                                                   |

---

# System Overview

FloodGuard addresses flood-related risks by combining:

- flood awareness;
- public flood information;
- citizen incident reporting;
- geographic map visualization;
- sensor-station monitoring;
- water-level history;
- automatic sensor alerts;
- official Authority alerts;
- administrator management;
- AWS-based storage;
- asynchronous event processing;
- serverless processing;
- cloud monitoring.

FloodGuard follows a **hybrid server-based and serverless/microservice-oriented architecture**.

The primary React/Vite and FastAPI application remains deployed through AWS Elastic Beanstalk, while selected workloads that benefit from event-driven processing, asynchronous execution, independent scaling, or failure isolation are implemented using AWS serverless services.

---

# User Roles

FloodGuard contains four primary application roles.

## Citizen / Public User

Citizens and public users can:

- access the FloodGuard landing page;
- view flood information;
- view historical flood information;
- access the Nepal flood map;
- register and log in;
- access the Citizen Dashboard;
- view active flood alerts;
- submit flood incident reports;
- provide province, district, zone, and coordinates;
- upload optional incident evidence images;
- manage profile information;
- manage flood-alert email preferences;
- use password recovery.

---

## Field Officer

Field Officers can:

- access the Field Officer Dashboard;
- manage sensor stations;
- manage sensor thresholds;
- use the Interactive Sensor Reader;
- inspect live water levels;
- inspect historical sensor readings;
- inspect sensor health information;
- generate controlled demonstration telemetry.

Protected sensor routes include:

```text
/sensors
/sensors/stations
/sensors/reader
/sensors/live
/sensors/history
/sensors/thresholds
/sensors/health
```

---

## Authority

Authorities can:

- access the Authority Dashboard;
- review pending citizen reports;
- inspect citizen evidence;
- inspect report location and map context;
- approve reports;
- reject reports;
- issue official FloodGuard flood alerts;
- use the controlled official broadcast workflow.

---

## Administrator

Administrators can:

- access the Administrator Dashboard;
- manage users;
- manage user roles;
- manage alert zones;
- maintain system configuration;
- review administrative records;
- access authorized system-management functionality.

---

# Technology Stack

## Frontend

- React
- Vite
- JavaScript
- HTML
- CSS
- Leaflet
- OpenStreetMap

## Backend

- Python
- FastAPI
- SQLAlchemy
- Alembic
- JWT Authentication
- Role-Based Access Control

## Database

- Amazon RDS for MySQL

## Cloud Platform

- Amazon Web Services (AWS)

## Version Control and CI/CD

- GitHub
- GitHub Actions

---

# AWS Architecture

FloodGuard uses a custom AWS architecture designed around security, availability, service separation, and event-driven processing.

The production architecture includes:

- Cloudflare DNS
- AWS Certificate Manager
- Application Load Balancer
- AWS Elastic Beanstalk
- Amazon EC2
- EC2 Auto Scaling
- Amazon VPC
- Two Availability Zones
- Public subnets
- Private application subnets
- Private database subnets
- Internet Gateway
- One NAT Gateway in Public Subnet A
- Security Groups
- Amazon RDS MySQL
- RDS Multi-AZ
- Amazon S3
- Amazon SQS
- SQS Dead-Letter Queue
- Amazon SNS
- AWS Lambda
- Amazon API Gateway
- Amazon CloudWatch
- AWS Systems Manager
- AWS IAM
- AWS Certificate Manager
- Amazon EventBridge
- GitHub Actions

---

# AWS Services Used

| AWS Service                     | FloodGuard Usage                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **AWS Elastic Beanstalk**       | Hosts and manages the production FastAPI/web application environment                                     |
| **Amazon EC2**                  | Provides application compute instances managed through Elastic Beanstalk                                 |
| **Application Load Balancer**   | Receives public HTTPS traffic and distributes requests to healthy application instances                  |
| **EC2 Auto Scaling**            | Maintains and scales the Elastic Beanstalk application instances                                         |
| **Amazon VPC**                  | Provides the isolated production network                                                                 |
| **Public Subnets**              | Contain the internet-facing Application Load Balancer and NAT Gateway                                    |
| **Private Application Subnets** | Contain Elastic Beanstalk EC2 application instances without direct public IPv4 exposure                  |
| **Private Database Subnets**    | Contain the private Amazon RDS deployment                                                                |
| **Internet Gateway**            | Provides public internet connectivity for internet-facing VPC resources                                  |
| **NAT Gateway**                 | Provides outbound internet connectivity for private application resources                                |
| **Security Groups**             | Restrict communication between load balancer, application, and database tiers                            |
| **Amazon RDS MySQL**            | Stores structured FloodGuard application and sensor data                                                 |
| **RDS Multi-AZ**                | Improves database availability through standby/failover capability                                       |
| **Amazon S3**                   | Stores citizen incident-report images, optimized image copies, and deployment packages                   |
| **Amazon SQS**                  | Buffers lightweight sensor events for asynchronous processing                                            |
| **SQS Dead-Letter Queue**       | Isolates sensor events that repeatedly fail processing                                                   |
| **Amazon SNS**                  | Delivers automated flood alerts, official Authority broadcasts, and private password-reset notifications |
| **AWS Lambda**                  | Provides independent serverless processing functions                                                     |
| **Amazon API Gateway**          | Provides the `/broadcast` API endpoint for official Authority alerts                                     |
| **Amazon CloudWatch**           | Provides logs, metrics, and operational monitoring                                                       |
| **AWS Systems Manager**         | Supports secure management and private RDS port forwarding                                               |
| **AWS IAM**                     | Provides service roles and permission management                                                         |
| **AWS Certificate Manager**     | Provides TLS certificate management for HTTPS                                                            |
| **Amazon EventBridge**          | Supports optional scheduled execution of the Sensor Simulator Lambda                                     |

---

# External Services

| Service            | Usage                                      |
| ------------------ | ------------------------------------------ |
| **Cloudflare DNS** | DNS management for `sunitanepali.com.np`   |
| **GitHub**         | Source-code repository and version control |
| **GitHub Actions** | CI/CD pipeline                             |
| **OpenStreetMap**  | Default map data provider                  |
| **Leaflet**        | Interactive map rendering                  |

FloodGuard does **not** use:

- Amazon Route 53 for DNS;
- Amazon SES for email;
- AWS CodeCommit;
- AWS CodePipeline;
- DynamoDB as the sensor telemetry database.

---

# Production Networking

FloodGuard uses a custom VPC across two AWS Availability Zones.

```text
Internet
   |
   v
Cloudflare DNS
   |
   v
Application Load Balancer
   |
   +-------------------------+
   |                         |
   v                         v
Private App Subnet A     Private App Subnet B
Elastic Beanstalk EC2    Elastic Beanstalk EC2
   |                         |
   +-----------+-------------+
               |
               v
        Amazon RDS MySQL
        Private DB Subnets
        Multi-AZ Deployment
```

The architecture includes:

- an internet-facing Application Load Balancer;
- private application instances;
- private RDS database access;
- two Availability Zones;
- one NAT Gateway in Public Subnet A;
- security-group-based communication control.

---

# Serverless and Microservice-Oriented Components

FloodGuard contains four Lambda-based components.

| Lambda Function                    | Trigger                           | Responsibility                                                                                   |
| ---------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `FloodGuard-Sensor-Simulator`      | EventBridge / optional invocation | Generates software-based demonstration sensor readings                                           |
| `FloodGuard-Auto-Sensor-Alert`     | Amazon SQS                        | Evaluates sensor-state transitions and determines whether an automated alert should be published |
| `FloodGuard-Optimize-Report-Image` | Amazon S3 ObjectCreated event     | Optimizes citizen incident-report images                                                         |
| `FloodGuard-Broadcast-Alert`       | Amazon API Gateway                | Handles official Authority flood-alert broadcasts                                                |

FloodGuard is intentionally **not described as a completely microservices-based application**.

The main application remains a cohesive server-based core, while suitable responsibilities are separated into independently triggered serverless components.

---

# Sensor Monitoring

Sensor stations store information including:

```text
id
name
district
latitude
longitude
warning_threshold
danger_threshold
is_active
created_at
province
river_basin
river_name
```

The application also maintains sensor status logic for states such as:

```text
SAFE
WATCH
WARNING
EMERGENCY
NO DATA
```

Threshold validation is performed by the frontend and backend.

---

# Interactive Sensor Reader

The Interactive Sensor Reader is the primary Field Officer demonstration tool.

Field Officers select:

- sensor station;
- duration;
- interval;
- reading pattern.

Available demonstration patterns include:

- Rising
- Falling
- Mixed

Each generated reading follows the protected application workflow.

```text
Interactive Sensor Reader
        |
        v
POST /api/sensors/simulator/generate-reading
        |
        v
FastAPI
        |
        v
Validate Sensor Station
        |
        v
Calculate Flood Status
        |
        v
Amazon RDS
        |
        v
Amazon SQS
        |
        v
Auto Sensor Alert Lambda
        |
        v
Amazon SNS
```

The current project uses **software-generated demonstration sensor telemetry**, not physical river IoT hardware.

---

# Sensor Alert Pipeline

Sensor telemetry is persisted before asynchronous alert processing begins.

```text
Field Officer
      |
      v
Interactive Sensor Reader
      |
      v
FastAPI Backend
      |
      v
Amazon RDS MySQL
      |
      v
Amazon SQS
FloodGuard-Sensor-Events
      |
      v
FloodGuard-Auto-Sensor-Alert
      |
      v
Transition / Deduplication Logic
      |
      v
Amazon SNS
      |
      v
Email Subscriber
```

Alert logic is based on meaningful state transitions.

```text
SAFE -> WATCH/WARNING/EMERGENCY       Publish
Repeated same state                   Do not publish
WATCH -> WARNING/EMERGENCY            Publish
WARNING -> EMERGENCY                  Publish
WARNING/EMERGENCY -> SAFE             One recovery notification
WATCH -> SAFE                         No recovery notification
```

This reduces duplicate alerts and alert fatigue.

---

# Amazon SQS

The primary sensor queue is:

```text
FloodGuard-Sensor-Events
```

SQS decouples the sensor-ingestion workflow from automated alert evaluation.

The application places lightweight sensor-event metadata onto SQS after the canonical sensor record is persisted in RDS.

CloudWatch monitoring includes:

- `NumberOfMessagesSent`
- `NumberOfMessagesReceived`
- `NumberOfMessagesDeleted`
- `ApproximateNumberOfMessagesVisible`
- `ApproximateAgeOfOldestMessage`
- `NumberOfEmptyReceives`
- `SentMessageSize`

A controlled test demonstrated messages being:

```text
Sent -> Received -> Processed -> Deleted
```

with no persistent queue backlog after processing.

---

# SQS Dead-Letter Queue

FloodGuard also uses:

```text
FloodGuard-Sensor-DLQ
```

The DLQ isolates repeatedly failing sensor events instead of allowing one problematic message to interfere with healthy queue processing.

---

# Amazon RDS MySQL

Amazon RDS is the canonical relational database for FloodGuard.

Important tables include:

```text
users
alert_zones
sensor_stations
sensor_readings
incident_reports
report_helpful_votes
flood_alerts
password_reset_tokens
alembic_version
```

RDS stores:

- user accounts;
- authentication and role information;
- alert zones;
- sensor stations;
- sensor thresholds;
- water-level telemetry;
- sensor history;
- citizen incident reports;
- flood alerts;
- password-reset records.

The RDS database:

- is not publicly accessible;
- uses encryption;
- uses Multi-AZ deployment;
- is placed in private database subnets.

---

# Private RDS Administrative Access

FloodGuard uses AWS Systems Manager port forwarding to administer the private RDS database without exposing MySQL directly to the public internet.

Example PowerShell command:

```powershell
$params = @{
    host = @("floodguard-db.cqgtmbvxwx6w.us-east-1.rds.amazonaws.com")
    portNumber = @("3306")
    localPortNumber = @("3307")
} | ConvertTo-Json -Compress

aws ssm start-session `
  --target <SSM-MANAGED-INSTANCE-ID> `
  --document-name AWS-StartPortForwardingSessionToRemoteHost `
  --parameters $params `
  --region us-east-1
```

MySQL Workbench can then connect through:

```text
Hostname: 127.0.0.1
Port: 3307
```

This approach allows the database to remain private.

---

# Amazon S3

FloodGuard uses the S3 bucket:

```text
ddac-floodguard
```

Important logical prefixes include:

```text
deployments/
original/incident-reports/
optimized/incident-reports/
```

## `deployments/`

Stores deployment bundles used by the Elastic Beanstalk deployment workflow.

## `original/incident-reports/`

Stores original citizen incident-report images.

## `optimized/incident-reports/`

Stores optimized counterparts created by the serverless image-processing Lambda.

---

# Citizen Incident Image Optimization

Citizen report images use an event-driven S3/Lambda workflow.

```text
Citizen uploads report image
        |
        v
S3
original/incident-reports/
        |
        v
S3 ObjectCreated Event
        |
        v
FloodGuard-Optimize-Report-Image
        |
        v
Pillow Image Processing
        |
        v
Compare Exact Byte Sizes
        |
        v
S3
optimized/incident-reports/
```

The original image is always preserved.

The Lambda:

1. downloads the source image;
2. generates an optimized candidate;
3. compares the exact source and candidate byte sizes;
4. stores the candidate only when it is smaller;
5. otherwise stores the original bytes in the optimized path.

A verified production example:

```text
Object:
95f7351a919a4da28074a69d7365584e-nab-upload-flood.jpeg

Original:
195,566 bytes

Optimized:
50,926 bytes

Saved:
144,640 bytes

Reduction:
Approximately 74%
```

---

# Amazon SNS

Amazon SNS is used for three primary notification categories.

## Automated Sensor Alerts

The `FloodGuard-Auto-Sensor-Alert` Lambda publishes qualifying flood-state transition alerts to SNS.

## Official Authority Alerts

Official Authority broadcasts are sent through the dedicated serverless broadcast flow.

## Password Recovery

Password-reset notifications use isolated per-user SNS topics instead of the shared flood-alert topic.

---

# Official Authority Alert Pipeline

Official Authority alerts are intentionally separated from automatic sensor alerts.

```text
Authority
    |
    v
Official Alert Interface
    |
    v
Amazon API Gateway
/broadcast
    |
    v
FloodGuard-Broadcast-Alert Lambda
    |
    v
Amazon SNS
    |
    v
Confirmed Subscribers
```

Official notifications are identified separately from automated sensor alerts.

---

# Password Recovery Using SNS

FloodGuard uses SNS-based private password recovery because Amazon SES is not used in the project environment.

Password-reset messages do not use the shared public flood-alert topic.

```text
User
 |
 v
Forgot Password
 |
 v
FastAPI
 |
 v
Check Private User SNS Topic
 |
 v
Subscription Confirmation
 |
 v
Generate Secure One-Time Token
 |
 v
Store Hashed Token in RDS
 |
 v
Amazon SNS
 |
 v
Registered User Email
```

Security controls include:

- deterministic private topic generation;
- confirmed subscriber validation;
- hashed reset tokens;
- token expiration;
- single-use tokens;
- session invalidation after successful reset;
- consistent public API responses for known and unknown accounts.

---

# Amazon API Gateway

Amazon API Gateway exposes the serverless Authority broadcast boundary.

Important route:

```text
/broadcast
```

The route integrates with:

```text
FloodGuard-Broadcast-Alert
```

This separates official broadcasting functionality from the main server-based application.

---

# AWS CloudWatch

CloudWatch provides monitoring and operational evidence for FloodGuard.

## Amazon SQS Metrics

Monitoring includes:

- messages sent;
- messages received;
- messages deleted;
- queue visibility;
- message age;
- message size.

## AWS Lambda Metrics

Monitoring includes:

- invocations;
- errors;
- duration;
- throttles;
- execution logs.

## Elastic Beanstalk and EC2 Metrics

Monitoring can include:

- environment health;
- CPU utilization;
- instance status;
- network activity;
- application logs.

## Amazon RDS Metrics

Monitoring can include:

- CPU utilization;
- database connections;
- free storage space;
- read latency;
- write latency.

CloudWatch is used to verify that AWS services are not only configured but actively processing FloodGuard workloads.

---

# Security Controls

FloodGuard implements security controls across application, network, and AWS-service layers.

## HTTPS

Cloudflare DNS resolves:

```text
https://sunitanepali.com.np/
```

TLS is supported through AWS Certificate Manager and the Application Load Balancer.

## Private Application Tier

Elastic Beanstalk EC2 instances run in private application subnets.

## Private Database Tier

Amazon RDS is not publicly accessible.

## Security Groups

Security-group references restrict communication between:

```text
Internet
    |
    v
Application Load Balancer
    |
    v
Application Instances
    |
    v
Amazon RDS
```

## Authentication

FloodGuard uses JWT-based authentication.

## Authorization

Backend Role-Based Access Control protects role-specific functionality.

## IAM

AWS services use IAM roles and permissions instead of credentials embedded in frontend code.

## Private Object Storage

Citizen evidence stored in S3 remains private.

## Failure Isolation

SQS and the Dead-Letter Queue isolate asynchronous processing failures.

---

# Availability and Reliability

FloodGuard includes several reliability mechanisms:

- Application Load Balancer;
- two Availability Zones;
- private application subnets across Availability Zones;
- EC2 Auto Scaling;
- RDS Multi-AZ;
- Amazon SQS asynchronous buffering;
- SQS Dead-Letter Queue;
- managed AWS Lambda execution;
- Amazon S3;
- CloudWatch monitoring.

The project uses one NAT Gateway in Public Subnet A as a cost-conscious academic design decision.

---

# Public Historical Flood Data

The guest-accessible route:

```text
/history
```

presents curated historical Nepal flood information.

Read-only endpoints include:

```text
GET /api/history/floods/summary
GET /api/history/floods/annual
GET /api/history/floods/events
GET /api/history/geography
GET /api/history/basins
GET /api/history/sources
```

Historical research data is separate from live or simulated sensor telemetry.

---

# Shared Interactive Map

The public route:

```text
/map
```

uses reusable Leaflet components.

The map displays public-safe information such as:

- active operational zones;
- active flood alerts;
- sensor stations;
- approved citizen reports containing coordinates.

Public map data is provided through:

```text
GET /api/public/map
```

The endpoint does not expose:

- user identity;
- private report-workflow information;
- sensor-management controls;
- AWS credentials;
- private configuration.

OpenStreetMap is the default map provider.

---

# FloodGuard Operational Zones

FloodGuard includes academic demonstration monitoring zones across all seven provinces of Nepal.

These locations are intended for system demonstration and are **not official government flood-risk boundaries**.

---

# CI/CD

FloodGuard uses:

```text
GitHub
+
GitHub Actions
```

It does not use AWS CodeCommit or AWS CodePipeline.

The deployment pipeline follows:

```text
Push / Merge to GitHub main
        |
        v
GitHub Actions
        |
        +--> Backend Tests
        |
        +--> Frontend Build
        |
        +--> Package Application
        |
        +--> Upload Deployment ZIP to S3
        |
        +--> Create Elastic Beanstalk Application Version
        |
        +--> Deploy to FloodGuard Production
        |
        v
Environment Health Verification
```

---

# Development Verification

## Backend Tests

```bash
python -m pytest -q
```

## Frontend Build

```bash
cd frontend
npm install
npm run build
```

## Image Optimization Lambda Tests

```bash
cd lambda/optimize_report_image
python -m pytest -q
```

## Database Migration

```bash
alembic upgrade head
```

---

# Optional Local Sensor Simulator

The project contains:

```text
scripts/simulate_water_level.py
```

This developer/testing utility can authenticate through the backend and submit sensor readings through the same application API.

It is not the primary Field Officer website workflow.

---

# Optional AWS Sensor Simulator

The cloud-based:

```text
FloodGuard-Sensor-Simulator
```

Lambda can be used as a software-based testing component.

Example server-side variables:

```text
FLOODGUARD_API_URL=<production-api-url>
SENSOR_STATION_CODE=<station-code>
SENSOR_INGESTION_TOKEN=<server-side-secret>
SIMULATOR_ENABLED=false
HTTP_TIMEOUT_SECONDS=8
```

The `SENSOR_INGESTION_TOKEN` must never be exposed to browser code.

---

# Environment and Secret Management

Never commit:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN
Database passwords
JWT secrets
Sensor ingestion tokens
Private API credentials
```

AWS services should use IAM roles and the normal AWS SDK credential-provider chain where possible.

---

# Important Implementation Notes

- FloodGuard is an academic cloud application.
- Sensor telemetry used in the current demonstration is software-generated.
- The project does not claim deployment of physical river IoT sensors.
- Public historical flood information is separate from operational sensor readings.
- Amazon RDS MySQL is the canonical telemetry database.
- DynamoDB is not used as the sensor-data database.
- Amazon SQS temporarily buffers sensor events; it is not long-term sensor storage.
- Cloudflare provides DNS.
- Amazon Route 53 is not used.
- Amazon SNS provides implemented email-notification workflows.
- Amazon SES is not used.
- GitHub provides source control.
- GitHub Actions provides CI/CD.
- AWS CodeCommit and AWS CodePipeline are not used.
- FloodGuard uses a hybrid server-based and serverless/microservice-oriented architecture rather than claiming to be fully microservices-based.

---

# Project Links

## Production Application

https://sunitanepali.com.np/

## GitHub Repository

https://github.com/nabinphoenix/FloodGuard

---

# Contributors

## Nabin Nepali

**APU Number:** NP069707  
**Role:** Administrator

## Rajesh Sapkota

**APU Number:** NP069734  
**Role:** Field Officer

## Ayushree Lamichhane

**APU Number:** NP069661  
**Role:** Citizen / Public User

## Prinsa Khadgi

**APU Number:** NP069734  
**Role:** Authority

---

# Disclaimer

FloodGuard was developed as an academic project for the **Designing and Developing Applications on the Cloud (DDAC)** module.

The current sensor data used for system demonstration is simulated, and the operational monitoring zones are academic demonstration data.

FloodGuard should not be interpreted as an official government emergency-warning platform or as a replacement for official flood-warning services.

---

**FloodGuard – A3_Group7**  
**Designing and Developing Applications on the Cloud (DDAC)**

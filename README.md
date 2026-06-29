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

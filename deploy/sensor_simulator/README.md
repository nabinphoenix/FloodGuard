# AWS Automated Sensor Simulator

`FloodGuard-Sensor-Simulator` is an optional cloud-architecture demonstration
that EventBridge invokes once per minute. It remains separate from the Field
Officer **Interactive Sensor Reader**, which is the primary website
demonstration tool.

```text
Optional AWS scheduler
EventBridge rate(1 minute), enabled
        |
        v
FloodGuard-Sensor-Simulator Lambda
        |
        v
POST /api/sensors/device-reading
        |
        v
RDS sensor_readings -> SQS FloodGuard-Sensor-Events -> Auto-Sensor-Alert -> SNS
```

The Field Officer website does not enable, disable, delete, or recreate the
EventBridge rule. FastAPI needs no EventBridge IAM permissions, so this works
with the AWS Academy `LabRole` restrictions. Keep the existing
`FloodGuard-Sensor-Simulator-Every-Minute` rule enabled for the optional cloud
demonstration.

## Required server-side configuration

Set the same high-entropy value in the Elastic Beanstalk backend environment
and Lambda environment as `SENSOR_INGESTION_TOKEN`. The backend rejects device
requests when this value is missing, and the token is never returned by the
API, sent to the frontend, or written to logs.

The Lambda environment variables are:

```text
FLOODGUARD_API_URL=https://<elastic-beanstalk-host>
SENSOR_STATION_CODE=STN001
SENSOR_INGESTION_TOKEN=<same-server-side-token>
SIMULATOR_ENABLED=false
HTTP_TIMEOUT_SECONDS=8
```

Set `SIMULATOR_ENABLED=true` only when the separate scheduled cloud simulator
is needed. It is not controlled by the browser. The Lambda requires only its
standard logging permissions; FastAPI, Elastic Beanstalk,
`LabInstanceProfile`, and `LabRole` require no EventBridge control policy.

## Interactive Sensor Reader

The Field Officer/Admin page at `/sensors/reader` starts a temporary browser
session. It schedules one protected FastAPI request at the chosen 10-, 30-, or
60-second interval for 1, 3, 5, or 10 minutes:

```text
Field Officer browser timer
        |
        v
POST /api/sensors/simulator/generate-reading
        |
        v
Canonical sensor ingestion service
        |
        v
RDS -> SQS -> FloodGuard-Auto-Sensor-Alert -> SNS on valid transitions
```

Each endpoint request creates exactly one reading. Stopping the browser session
cancels future calls; it does not make a long-running FastAPI request or alter
EventBridge. The endpoint is protected for `field_officer` and `admin`, and
has a server-side five-second minimum request interval. The browser never sees
AWS credentials or the device ingestion token.

## Package the optional Lambda

From the repository root:

```text
python deploy/make_sensor_simulator_zip.py
```

This creates the ignored local artifact
`deploy/floodguard-sensor-simulator.zip`. The handler is
`handler.lambda_handler`, runtime `python3.12` (or another supported Python
3.x runtime). The existing EventBridge resource policy permission allowing the
rule to invoke the Lambda remains required; no EventBridge permission is
required by the FloodGuard application.

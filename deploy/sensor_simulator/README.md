# AWS Automated Sensor Simulator

The repository contains a dependency-free Lambda at
`lambda/sensor_simulator/handler.py`. It is designed for this architecture:

```text
EventBridge rate(1 minute)
        |
        v
FloodGuard-Sensor-Simulator Lambda
        |
        v
POST /api/sensors/device-reading
```

Each invocation fetches the configured station thresholds through
`GET /api/sensors/device-stations/{station_code}`, generates exactly one
measurement for the current phase, submits exactly one reading, and exits.
There is no long-running loop and no DynamoDB state table.

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

`SIMULATOR_ENABLED` defaults to `false`. Set it to `true` only for the cloud
demonstration. The current implementation uses the course environment's
server-side environment-variable fallback. Do not put the token in source,
Git, frontend variables, Lambda logs, or committed deployment files. If the
AWS account permits it later, the token can be moved to SSM Parameter Store
SecureString without changing the API contract.

## Package the Lambda

From the repository root:

```text
python deploy/make_sensor_simulator_zip.py
```

This creates the ignored local artifact
`deploy/floodguard-sensor-simulator.zip`. The handler is
`handler.lambda_handler`, runtime `python3.12` (or another supported Python
3.x runtime), and the function only needs the standard Lambda CloudWatch Logs
execution policy.

## Create or update the Lambda manually

The existing GitHub Actions workflow deploys Elastic Beanstalk but does not
create Lambda or EventBridge resources. Use the AWS Console or AWS CLI with a
real Lambda execution-role ARN and the environment values above. Never paste a
real token into a committed file or shell history.

Example CLI shape with placeholders:

```text
aws lambda create-function `
  --function-name FloodGuard-Sensor-Simulator `
  --runtime python3.12 `
  --handler handler.lambda_handler `
  --role arn:aws:iam::<account-id>:role/<lambda-execution-role> `
  --zip-file fileb://deploy/floodguard-sensor-simulator.zip `
  --timeout 15 `
  --memory-size 128 `
  --environment "Variables={FLOODGUARD_API_URL=https://<elastic-beanstalk-host>,SENSOR_STATION_CODE=STN001,SENSOR_INGESTION_TOKEN=<token>,SIMULATOR_ENABLED=false,HTTP_TIMEOUT_SECONDS=8}"
```

For an existing function, use `aws lambda update-function-code` and update its
environment in the Lambda Console or with `update-function-configuration`.
When using the CLI, include every environment variable because an environment
update replaces the complete variable map.

## Create the EventBridge rule and target

The exact resource names are:

```text
FloodGuard-Sensor-Simulator
FloodGuard-Sensor-Simulator-Every-Minute
rate(1 minute)
ENABLED
```

PowerShell/AWS CLI steps:

```text
aws events put-rule `
  --name FloodGuard-Sensor-Simulator-Every-Minute `
  --schedule-expression "rate(1 minute)" `
  --state ENABLED

$ruleArn = aws events describe-rule --name FloodGuard-Sensor-Simulator-Every-Minute --query Arn --output text
$lambdaArn = aws lambda get-function --function-name FloodGuard-Sensor-Simulator --query Configuration.FunctionArn --output text

aws lambda add-permission `
  --function-name FloodGuard-Sensor-Simulator `
  --statement-id FloodGuardEventBridgeInvoke `
  --action lambda:InvokeFunction `
  --principal events.amazonaws.com `
  --source-arn $ruleArn

aws events put-targets `
  --rule FloodGuard-Sensor-Simulator-Every-Minute `
  --targets "Id=FloodGuardSensorSimulator,Arn=$lambdaArn"
```

The Lambda resource policy permission is required for EventBridge to invoke
the function. Test one invocation manually before enabling the demonstration:

```text
aws lambda invoke --function-name FloodGuard-Sensor-Simulator response.json
```

## Enable or disable the cloud demonstration

Preferred application-level control: update the Lambda environment variable
`SIMULATOR_ENABLED` to `true` or `false`, keeping the EventBridge rule in
place. A disabled invocation logs `Simulator disabled` and sends no request.

To stop scheduling entirely:

```text
aws events disable-rule --name FloodGuard-Sensor-Simulator-Every-Minute
```

To resume scheduling:

```text
aws events enable-rule --name FloodGuard-Sensor-Simulator-Every-Minute
```

The backend device endpoints are:

```text
GET  /api/sensors/device-stations/{station_code}
POST /api/sensors/device-reading
Header: X-Sensor-Token
Body: {"station_code":"STN001","water_level":3.91}
```

The normal authenticated `POST /api/sensors/reading` route remains available
for Field Officer/local manual testing. Both routes use the same backend
processing service and therefore preserve threshold classification and SNS
transition behavior.

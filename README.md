# FloodGuard

FloodGuard is a flood monitoring and reporting application with role-based
operations dashboards, public Nepal flood research, relational sensor
telemetry history, and AWS-backed alert processing.

## Public historical flood data

The guest-accessible route `/history` presents curated Nepal flood research
for 2011-2023, major historical events, provinces/districts, rivers, and basin
context. It is separate from live sensor measurements.

Read-only public endpoints:

    GET /api/history/floods/summary
    GET /api/history/floods/annual
    GET /api/history/floods/events
    GET /api/history/geography
    GET /api/history/basins
    GET /api/history/sources

The annual values are national totals from the supplied Nepal DRR
Portal-based study. They are not province or district totals. The geography
reference is the supplied research subset, not all 77 districts. The page
shows source metadata, boundary notes, and data limitations.

## Field Officer sensor operations

Field Officers and Admins use these protected routes:

    /sensors
    /sensors/stations
    /sensors/live
    /sensors/history
    /sensors/thresholds
    /sensors/health

The sidebar deliberately uses Sensor Stations, Live Water Levels, and Water
Level History. Public historical research remains at `/history` and is not a
Field Officer sensor-management function.

Stations contain:

    station_code, name, province, district, river_basin, river_name
    latitude, longitude
    watch_threshold, warning_threshold, danger_threshold
    is_active

The existing `danger_threshold` database column is shown in the UI as
Emergency Level for compatibility. Station CRUD is restricted to Field
Officer/Admin users. A station with historical telemetry cannot be deleted;
deactivate it instead.

Sensor states are calculated by the backend:

    SAFE       level < Watch
    WATCH      Watch <= level < Warning
    WARNING    Warning <= level < Emergency
    EMERGENCY  level >= Emergency
    NO DATA    no reading exists

Threshold validation is applied in both the API and UI:

    Watch >= 0
    Watch < Warning
    Warning < Emergency
    -90 <= latitude <= 90
    -180 <= longitude <= 180

Official Authority alerts remain separate from automated sensor alerts. Sensor
notifications are labelled `Automated Sensor Alert`; Authority broadcasts
remain `Official FloodGuard Early Warning Alert`.

## FloodGuard Sensor Demonstration

1. Create or use a Field Officer account.
2. Open Field Officer -> Sensor Stations -> Add Sensor Station.
3. Create a station such as:

       Code: STN001
       Name: Narayani River Station
       Province: Bagmati
       District: Chitwan
       Basin: Gandaki / Narayani Basin
       River: Narayani

4. Set thresholds, for example Watch 2.50 m, Warning 3.50 m, Emergency
   4.50 m.
5. Run the real API simulator from the repository root:

       $env:FLOODGUARD_EMAIL = "field-officer@example.com"
       python scripts/simulate_water_level.py --api-url http://localhost:8000 --station STN001 --interval 5 --count 11

   The password is prompted securely. For a local-only demonstration it may
   also be supplied through `FLOODGUARD_PASSWORD`; do not commit it.
6. Watch `/sensors`, `/sensors/live`, `/sensors/history`,
   `/sensors/thresholds`, and `/sensors/health`.
7. The default `--scenario cycle` sends SAFE, WATCH, WARNING and EMERGENCY
   values derived from the station's actual thresholds. Use a fixed state when
   needed:

       python scripts/simulate_water_level.py --api-url http://localhost:8000 --station STN001 --state warning --count 5

The simulator logs in through `/api/auth/login`, retrieves the selected
station's thresholds through the API, and submits real
`POST /api/sensors/reading` requests. It never prints a JWT or credentials,
and it exits cleanly with Ctrl+C.

## Sensor alerts and AWS services

A reading is committed before SQS/SNS delivery is attempted. The existing
`SQS_SENSOR_QUEUE_URL` queue receives the sensor event. The existing
`SNS_TOPIC_ARN` topic is used for automated sensor emails; no new SNS topic
or subscription is created.

SNS sends only on meaningful backend transitions:

    SAFE -> WATCH/WARNING/EMERGENCY       publish
    repeated same state                   do not publish
    WATCH -> WARNING/EMERGENCY             publish
    WARNING -> EMERGENCY                   publish
    WARNING/EMERGENCY -> SAFE              one recovery message
    WATCH -> SAFE                          no recovery message

SNS failures are logged and returned as notification metadata while the
telemetry remains saved. Official Authority alert publishing is unchanged.

This repository currently has no DynamoDB sensor-table client or configured
sensor table: `sensor_readings` is the canonical relational telemetry table,
and SQS remains the existing event queue. System Health reports
`DYNAMODB_SENSOR_TABLE_NAME` as not configured unless an existing deployment
provides that table. No DynamoDB table is created by this change and no fake
production fallback is used.

## Development verification

Backend:

    python -m pytest -q

Lambda:

    cd lambda/optimize_report_image
    python -m pytest -q

Frontend:

    cd frontend
    npm run build

Apply the schema migration in a deployment before using the new persisted
reading status field:

    alembic upgrade head

AWS credentials are supplied through the normal boto3/Elastic Beanstalk
provider chain. Never commit AWS access keys, session tokens, passwords, JWTs,
or private S3 settings.

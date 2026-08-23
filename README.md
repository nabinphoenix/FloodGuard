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
5. Open Field Officer -> Sensor Reader, choose the station, duration,
   interval, and pattern, then select **Start Reading**. Each reading uses the
   protected backend and the existing RDS -> SQS pipeline; no AWS credential
   or device token is sent to the browser.
6. Watch `/sensors`, `/sensors/reader`, `/sensors/live`, `/sensors/history`,
   `/sensors/thresholds`, and `/sensors/health`.

## Local developer simulator option

For local developer/testing only, `scripts/simulate_water_level.py` can still
authenticate through `/api/auth/login`, read a station's thresholds, and submit
real `POST /api/sensors/reading` requests. It is not part of the Field Officer
website workflow.

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

## Interactive Sensor Reader

The Field Officer Sensor Reader is the website demonstration tool. The browser
starts a bounded temporary session and invokes the backend once per selected
interval:

    Interactive Sensor Reader browser timer
        |
        v
    POST /api/sensors/simulator/generate-reading
        |
        v
    Canonical sensor ingestion service

Each request generates one value from the selected station's own thresholds.
The rising, falling, and mixed patterns are bounded to produce a realistic
demonstration of SAFE, WATCH, WARNING, and EMERGENCY status changes.

The Sensor Reader endpoint is JWT-protected for Field Officers and admins and
shares the same RDS persistence, backend classification, and SQS dispatch as
other sensor readings. No AWS key or device token is exposed to the frontend.

## Optional AWS Automated Sensor Simulator

The local `scripts/simulate_water_level.py` utility remains available for
quick manual tests. The existing cloud Lambda may separately run from its
enabled one-minute EventBridge scheduler. It uses the protected device endpoint
and server-only `X-Sensor-Token`; configure a high-entropy
`SENSOR_INGESTION_TOKEN` in both Elastic Beanstalk and Lambda, never in Git.

Required Lambda variables:

    FLOODGUARD_API_URL=https://<elastic-beanstalk-host>
    SENSOR_STATION_CODE=STN001
    SENSOR_INGESTION_TOKEN=<server-side-token>
    SIMULATOR_ENABLED=false
    HTTP_TIMEOUT_SECONDS=8

The Interactive Sensor Reader page controls only a temporary browser timing
session. Each selected interval produces one protected backend request, which
uses the same RDS persistence and SQS dispatch as every other sensor reading.
It does not manage EventBridge. The existing `FloodGuard-Sensor-Simulator`
Lambda and enabled one-minute EventBridge rule may remain available separately
for cloud-architecture demonstration. The exact packaging and token
instructions are in `deploy/sensor_simulator/README.md`.

Sensor dashboards show the last reading time and identify telemetry older than
five minutes as stale; staleness does not change the backend flood status.
All user-facing FloodGuard timestamps render in Kathmandu time (NPT,
UTC+05:45). Persisted telemetry and machine-to-machine event timestamps remain
UTC instants so ordering, freshness, and security expiry calculations stay
correct.


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

## Private password reset email through SNS

Flood alerts continue to use the shared opt-in `SNS_TOPIC_ARN`. Password-reset
links never use that shared topic. FloodGuard creates one deterministic private
SNS standard topic per registered email, using an HMAC digest rather than the
email address in the topic name, and audits the topic before every publication.
Publishing is refused if any subscription endpoint does not exactly match the
registered user or if more than one confirmed subscription exists.

The SNS-only reset flow is:

1. The user submits an existing FloodGuard account email.
2. If its private SNS subscription is not confirmed, SNS sends an AWS
   subscription-confirmation email. No reset token is created yet.
3. The user confirms the subscription and submits forgot password again.
4. FloodGuard creates a hashed, one-time token and publishes its link only to
   that user's audited private topic.
5. The email arrives from `AWS Notifications <no-reply@sns.amazonaws.com>`.

Enabling flood-alert email also starts the separate password-reset subscription
confirmation. Disabling flood alerts leaves the private reset subscription in
place. Existing and unknown email addresses receive the same API response.

Elastic Beanstalk configuration uses:

    PASSWORD_RESET_SNS_TOPIC_PREFIX=FloodGuard-Password-Reset-User

The application role needs `sns:CreateTopic`, `sns:Subscribe`,
`sns:ListSubscriptionsByTopic`, `sns:GetSubscriptionAttributes`, and
`sns:Publish`. The manually created shared
`FloodGuard-Password-Reset` topic is suitable for delivery tests only and must
not receive real reset tokens. Tokens remain SHA-256 hashed in RDS, expire after
20 minutes, are single use, and invalidate previous sessions after a reset.

## FloodGuard operational/demo zones

The canonical demo dataset is defined once in
`backend/data/flood_zone_seeds.py`. It contains 32 approximate operational
centre points across all seven Nepal provinces. These are FloodGuard academic
demo monitoring zones, not official government flood-risk boundaries.

Migration `i2j3k4l5m6n` adds real zone names and activation status, permits
multiple named zones in one district, preserves existing records, and inserts
only missing seed names. Elastic Beanstalk already runs `alembic upgrade head`
as a leader-only deployment command, so existing production RDS databases
receive the one-time seed through the normal migration path.

The same idempotent seed can be invoked manually after migrations when needed:

    cd backend
    python -m seeders.flood_zones

## Shared interactive maps

The public route `/map` uses the reusable Leaflet components in
`frontend/src/components/map`. It displays public-safe active zones, active
alerts, active sensor stations, and approved reports that include coordinates.

The map defaults to OpenStreetMap with required attribution and is centred on
Nepal. To use MapTiler in a deployment, set `VITE_MAP_PROVIDER=maptiler` and
provide `VITE_MAPTILER_API_KEY`; no map key is required for the default OSM
configuration.

The public payload is served by:

    GET /api/public/map

The endpoint does not expose user identity, private report workflow fields,
sensor-management controls, or secret AWS configuration. Sensor markers keep
staleness separate from SAFE/WATCH/WARNING/EMERGENCY status. Zones are rendered
as centre markers because the current AlertZone model stores coordinates but no
radius or polygon boundary.

The same `LocationPicker` is used by public incident reports, sensor station
management, and admin zone management. It supports map clicks, draggable
markers, manual coordinate fields, one-time browser geolocation on explicit
button press, clear/reset, and broad latitude/longitude validation.

# FloodGuard

FloodGuard is a flood monitoring and reporting application with relational sensor
history, role-based operations dashboards, and AWS-backed alert processing.

## Authenticated sensor simulator

Start the backend, then run the simulator from the repository root:

    $env:FLOODGUARD_EMAIL = "field-officer@example.com"
    python scripts/simulate_water_level.py --api-url http://localhost:8000 --station STN001 --interval 5 --count 10

The simulator prompts for the password unless FLOODGUARD_PASSWORD is set. It
logs in through /api/auth/login, fetches the selected station's current
warning and danger thresholds, and posts readings to /api/sensors/reading. It
appends /api safely when the supplied URL does not already contain it. Use
--count 0 (the default) for continuous operation and stop with Ctrl+C. It does
not seed the database or print credentials/tokens.

The simulator requires a field officer or admin account and reports a clean
error if the station ID does not exist. Run
python scripts/simulate_water_level.py --help for all options.

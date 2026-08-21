# FloodGuard

FloodGuard is a flood monitoring and reporting application with relational sensor
history, role-based operations dashboards, public historical research, and
AWS-backed alert processing.

## Public historical flood data

The guest-accessible route /history presents curated Nepal flood research for
2011-2023, major historical events, provinces/districts, rivers, and basin
context. Its data is separate from live sensor measurements.

Read-only public endpoints are:

    GET /api/history/floods/summary
    GET /api/history/floods/annual
    GET /api/history/floods/events
    GET /api/history/geography
    GET /api/history/basins
    GET /api/history/sources

The annual values are national totals from the supplied Nepal DRR
Portal-based study. They must not be treated as province or district totals.
The geography reference represents the districts in the current research
dataset, not all 77 districts. The history page includes source metadata and
limitations, including changed administrative boundaries and non-comparable
historical series.

## Live sensor monitoring

Field Officers and Admins can use /sensors with cascading Province, District,
River Basin, River, and Station filters. The existing station id/name remain
the station code/name. Known stations also expose province, district, basin,
river, latest reading, and operational thresholds.

Sensor states are calculated from station-specific settings:

    SAFE       level < Watch
    WATCH      Watch <= level < Warning
    WARNING    Warning <= level < Emergency
    EMERGENCY  level >= Emergency
    NO DATA    no reading exists

Thresholds are operational monitoring settings, not historical-data-derived
scientific standards. The /sensors/thresholds page validates Watch >= 0,
Watch < Warning, and Warning < Emergency. Existing danger_threshold storage is
presented as Emergency Level for compatibility.

## Authenticated sensor simulator

Start the backend, then run the simulator from the repository root:

    $env:FLOODGUARD_EMAIL = "field-officer@example.com"
    python scripts/simulate_water_level.py --api-url http://localhost:8000 --station STN001 --interval 5 --count 10

The simulator prompts for the password unless FLOODGUARD_PASSWORD is set. It
logs in through /api/auth/login, fetches the selected station's live Watch,
Warning, and Emergency thresholds, and posts readings to
/api/sensors/reading. It appends /api safely when the supplied URL does not
already contain it. Use --count 0 (the default) for continuous operation and
stop with Ctrl+C. It does not seed the database or print credentials/tokens.

The simulator cycles safely through SAFE, WATCH, WARNING, EMERGENCY, WARNING,
WATCH, and SAFE. It requires a Field Officer or Admin account and reports a
clean error if the station ID does not exist. Run
python scripts/simulate_water_level.py --help for all options.

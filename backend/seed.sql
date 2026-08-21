INSERT INTO sensor_stations (
    id,
    name,
    province,
    district,
    river_basin,
    river_name,
    latitude,
    longitude,
    watch_threshold,
    warning_threshold,
    danger_threshold,
    is_active
) VALUES
    ('STN001', 'Narayani River', 'Bagmati', 'Chitwan', 'Gandaki / Narayani Basin', 'Narayani', 27.6710, 84.4305, 2.5, 3.5, 4.5, 1),
    ('STN002', 'Bagmati River', 'Bagmati', 'Kathmandu', 'Bagmati Basin', 'Bagmati', 27.7172, 85.3240, 2.2, 3.2, 4.2, 1),
    ('STN003', 'Seti River', 'Gandaki', 'Kaski', 'Gandaki / Narayani Basin', 'Seti', 28.2096, 83.9856, 2.0, 3.0, 4.0, 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    province = VALUES(province),
    district = VALUES(district),
    river_basin = VALUES(river_basin),
    river_name = VALUES(river_name),
    latitude = VALUES(latitude),
    longitude = VALUES(longitude),
    watch_threshold = VALUES(watch_threshold),
    warning_threshold = VALUES(warning_threshold),
    danger_threshold = VALUES(danger_threshold),
    is_active = VALUES(is_active);

INSERT INTO alert_zones (
    district,
    alert_level,
    latitude,
    longitude
) VALUES
    ('Chitwan', 'safe', 27.6710, 84.4305),
    ('Kathmandu', 'safe', 27.7172, 85.3240),
    ('Kaski', 'safe', 28.2096, 83.9856)
ON DUPLICATE KEY UPDATE
    alert_level = VALUES(alert_level),
    latitude = VALUES(latitude),
    longitude = VALUES(longitude),
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO users (
    name,
    email,
    phone,
    district,
    password_hash,
    role,
    email_alerts,
    sns_subscription_arn
) VALUES
    (
        'FloodGuard Admin',
        'admin@floodguard.com',
        '+97712345678',
        'Chitwan',
        '$2b$12$cK6wPFzjh6eHTeG48aau5uKT0Am2z4ZKvS1QY/uwsKy7baNnbYYS.',
        'admin',
        1,
        NULL
    ),
    (
        'FloodGuard Authority',
        'authority@floodguard.com',
        '+97712345679',
        'Kathmandu',
        '$2b$12$JZFKGzTPEhOymddQHlHmYe5C2vqUueGuBud6QAVmakCJDHbILjpTS',
        'authority',
        1,
        NULL
    ),
    (
        'FloodGuard Field Officer',
        'simulator@floodguard.com',
        '+97712345680',
        'Kaski',
        '$2b$12$examplehashforfieldofficer',
        'field_officer',
        1,
        NULL
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    phone = VALUES(phone),
    district = VALUES(district),
    password_hash = VALUES(password_hash),
    role = VALUES(role),
    email_alerts = VALUES(email_alerts),
    sns_subscription_arn = VALUES(sns_subscription_arn);

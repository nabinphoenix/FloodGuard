INSERT INTO sensor_stations (
    id,
    name,
    district,
    latitude,
    longitude,
    warning_threshold,
    danger_threshold,
    is_active
) VALUES
    ('STN001', 'Klang River KL', 'Kuala Lumpur', 3.1390, 101.6869, 3.50, 4.50, 1),
    ('STN002', 'Gombak River Selangor', 'Selangor', 3.2366, 101.6819, 3.20, 4.20, 1),
    ('STN003', 'Muar River Johor', 'Johor', 2.0442, 102.5689, 3.00, 4.00, 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    district = VALUES(district),
    latitude = VALUES(latitude),
    longitude = VALUES(longitude),
    warning_threshold = VALUES(warning_threshold),
    danger_threshold = VALUES(danger_threshold),
    is_active = VALUES(is_active);

INSERT INTO alert_zones (
    district,
    alert_level,
    latitude,
    longitude
) VALUES
    ('Kuala Lumpur', 'safe', 3.1390, 101.6869),
    ('Selangor', 'safe', 3.0738, 101.5183),
    ('Johor', 'safe', 1.4854, 103.7618),
    ('Kelantan', 'safe', 6.1254, 102.2381)
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
    sms_alerts,
    sns_subscription_arn
) VALUES
    (
        'FloodGuard Admin',
        'admin@floodguard.com',
        '+60120000001',
        'Kuala Lumpur',
        '$2b$12$cK6wPFzjh6eHTeG48aau5uKT0Am2z4ZKvS1QY/uwsKy7baNnbYYS.',
        'admin',
        1,
        1,
        NULL
    ),
    (
        'FloodGuard Authority',
        'authority@floodguard.com',
        '+60120000002',
        'Selangor',
        '$2b$12$JZFKGzTPEhOymddQHlHmYe5C2vqUueGuBud6QAVmakCJDHbILjpTS',
        'authority',
        1,
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
    sms_alerts = VALUES(sms_alerts),
    sns_subscription_arn = VALUES(sns_subscription_arn);

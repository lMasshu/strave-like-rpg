-- 1. Joueurs de test (avec UUID valides compatibles PostgreSQL)
INSERT INTO players (id, username, level, experience, created_at)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'Lucas_Run', 1, 820, '2026-01-01T00:00:00Z'),
    ('22222222-2222-4222-8222-222222222222', 'Lea_Trail', 4, 3450, '2026-01-15T10:00:00Z'),
    ('33333333-3333-4333-8333-333333333333', 'Hugo_Bike', 7, 6800, '2026-02-01T14:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- 2. Boss de Raid actifs (ST_MakePoint(longitude, latitude))
INSERT INTO raids (id, name, max_health, current_health, location, radius_meters, elevation_multiplier, status, expires_at)
VALUES
    (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Titan de la ville',
        1000000,
        580000,
        ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326), -- Centre Paris (rayon 10 km)
        10000,
        1.50,
        'active',
        NOW() + INTERVAL '2 days'
    ),
    (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'Colosse des Collines',
        2500000,
        2100000,
        ST_SetSRID(ST_MakePoint(4.8357, 45.7640), 4326), -- Lyon (sensible au dénivelé)
        15000,
        2.50,
        'active',
        NOW() + INTERVAL '5 days'
    )
ON CONFLICT (id) DO NOTHING;

-- 3. Activité sportive de démonstration avec tracé GPS PostGIS
INSERT INTO activities (
    id, player_id, activity_type, started_at, ended_at,
    distance_meters, duration_seconds, elevation_gain_meters, track
)
VALUES (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '11111111-1111-4111-8111-111111111111',
    'run',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '30 minutes',
    5200,
    1800,
    45,
    ST_SetSRID(
        ST_GeomFromText('LINESTRING(2.3522 48.8566, 2.3530 48.8575, 2.3545 48.8590, 2.3560 48.8602)'),
        4326
    )
)
ON CONFLICT (id) DO NOTHING;
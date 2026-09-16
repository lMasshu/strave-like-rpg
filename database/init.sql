CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(40) NOT NULL UNIQUE,
    level INTEGER NOT NULL DEFAULT 1 CHECK (level > 0),
    experience INTEGER NOT NULL DEFAULT 0 CHECK (experience >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    max_health BIGINT NOT NULL CHECK (max_health > 0),
    current_health BIGINT NOT NULL CHECK (current_health >= 0 AND current_health <= max_health),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id),
    activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('walk', 'run', 'bike', 'hike')),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    distance_meters INTEGER NOT NULL DEFAULT 0 CHECK (distance_meters >= 0),
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    track GEOMETRY(LineString, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS activities_player_id_idx ON activities (player_id);
CREATE INDEX IF NOT EXISTS activities_started_at_idx ON activities (started_at DESC);
CREATE INDEX IF NOT EXISTS activities_track_gist_idx ON activities USING GIST (track);

CREATE TABLE IF NOT EXISTS raid_damage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raid_id UUID NOT NULL REFERENCES raids(id),
    player_id UUID NOT NULL REFERENCES players(id),
    activity_id UUID NOT NULL REFERENCES activities(id),
    damage BIGINT NOT NULL CHECK (damage > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raid_damage_events_raid_id_idx ON raid_damage_events (raid_id);

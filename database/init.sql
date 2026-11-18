CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- 1. Table des joueurs (= comptes utilisateurs)
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(40) NOT NULL UNIQUE,
    -- Identifiant de connexion, unique sans tenir compte de la casse
    email CITEXT NOT NULL UNIQUE CHECK (length(email) <= 254),
    -- Hash scrypt « scrypt$N$r$p$sel$hash » ; NULL pour un compte créé uniquement via Google
    password_hash TEXT,
    -- Identifiant Auth0 (ex. « google-oauth2|123 ») quand le compte est lié à Google
    auth0_sub VARCHAR(255) UNIQUE,
    level INTEGER NOT NULL DEFAULT 1 CHECK (level > 0),
    experience INTEGER NOT NULL DEFAULT 0 CHECK (experience >= 0),
    coach_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    coach_goal VARCHAR(30) NOT NULL DEFAULT 'casual' CHECK (coach_goal IN ('casual', 'active', 'marathon', 'half-marathon', '10k', '5k')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Un compte doit toujours avoir au moins un moyen de connexion
    CHECK (password_hash IS NOT NULL OR auth0_sub IS NOT NULL)
);

-- 2. Table des Boss de Raid (géolocalisés)
CREATE TABLE IF NOT EXISTS raids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    max_health BIGINT NOT NULL CHECK (max_health > 0),
    current_health BIGINT NOT NULL CHECK (current_health >= 0 AND current_health <= max_health),
    location GEOMETRY(Point, 4326) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 5000 CHECK (radius_meters > 0),
    elevation_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.50 CHECK (elevation_multiplier >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raids_location_gist_idx ON raids USING GIST (location);
CREATE INDEX IF NOT EXISTS raids_status_idx ON raids (status);

-- 3. Table des activités sportives
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('walk', 'run', 'bike', 'hike')),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    distance_meters INTEGER NOT NULL DEFAULT 0 CHECK (distance_meters >= 0),
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    elevation_gain_meters INTEGER NOT NULL DEFAULT 0 CHECK (elevation_gain_meters >= 0),
    track GEOMETRY(LineString, 4326),
    recording JSONB,
    -- Séance importée depuis une montre (Health Connect / Apple Santé), NULL si enregistrée par l'appli
    external_source VARCHAR(20) CHECK (external_source IN ('health-connect', 'apple-health')),
    external_id VARCHAR(200),
    -- Montre d'origine si connue (ex. « Garmin Forerunner 255 »), affichée dans l'historique
    external_device VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ended_at IS NULL OR ended_at >= started_at),
    CHECK ((external_source IS NULL) = (external_id IS NULL))
);

CREATE INDEX IF NOT EXISTS activities_player_id_idx ON activities (player_id);
-- Empêche d'importer deux fois la même séance de montre (et donc de recréditer l'XP)
CREATE UNIQUE INDEX IF NOT EXISTS activities_external_ref_uniq
    ON activities (player_id, external_source, external_id)
    WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS activities_started_at_idx ON activities (started_at DESC);
CREATE INDEX IF NOT EXISTS activities_track_gist_idx ON activities USING GIST (track);

-- 4. Historique des dégâts infligés aux boss
CREATE TABLE IF NOT EXISTS raid_damage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raid_id UUID NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    damage BIGINT NOT NULL CHECK (damage > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (raid_id, activity_id) -- Empêche de comptabiliser deux fois la même course sur un raid
);

CREATE INDEX IF NOT EXISTS raid_damage_events_raid_id_idx ON raid_damage_events (raid_id);
CREATE INDEX IF NOT EXISTS raid_damage_events_player_id_idx ON raid_damage_events (player_id);


-- 5. Bilans hebdomadaires du Maître de Guilde (Coach IA)
CREATE TABLE IF NOT EXISTS coach_weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    year INT NOT NULL CHECK (year >= 2026),
    week_number INT NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    report_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (player_id, year, week_number)
);

CREATE INDEX IF NOT EXISTS coach_weekly_reports_player_idx
    ON coach_weekly_reports (player_id, year DESC, week_number DESC);

-- 6. Historique de conversation avec le Maître de Guilde
CREATE TABLE IF NOT EXISTS coach_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_messages_player_idx
    ON coach_messages (player_id, created_at DESC);

-- 7. Liste d'amis : un joueur en suit un autre (relation à sens unique, comme « Suivre »)
CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    followed_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followed_id),
    CHECK (follower_id <> followed_id)
);

-- « Qui me suit ? » (la clé primaire couvre déjà « qui je suis »)
CREATE INDEX IF NOT EXISTS follows_followed_id_idx ON follows (followed_id);

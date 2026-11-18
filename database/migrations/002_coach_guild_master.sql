-- Migration 002 : Maître de Guilde (Coach IA & Suivi de progression)
-- Rejouable sans risque

-- 1. Préférences joueur pour le Maître de Guilde
ALTER TABLE players
    ADD COLUMN IF NOT EXISTS coach_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS coach_goal VARCHAR(30) NOT NULL DEFAULT 'casual'
        CHECK (coach_goal IN ('casual', 'active', 'marathon', 'half-marathon', '10k', '5k'));

-- 2. Bilans hebdomadaires générés par le Maître de Guilde (1 par semaine par joueur maximum)
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

-- 3. Historique de conversation avec le Maître de Guilde
CREATE TABLE IF NOT EXISTS coach_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_messages_player_idx
    ON coach_messages (player_id, created_at DESC);

-- Liste d'amis : un joueur en suit un autre (relation à sens unique, comme « Suivre »).
-- À appliquer sur une base créée avant l'ajout de la table (init.sql l'inclut déjà
-- pour les nouvelles bases). Rejouable sans risque.
-- docker exec -i stride_quest_postgres psql -U stride -d stride_quest < database/migrations/003_follows.sql
CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    followed_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followed_id),
    CHECK (follower_id <> followed_id)
);

-- « Qui me suit ? » (la clé primaire couvre déjà « qui je suis »)
CREATE INDEX IF NOT EXISTS follows_followed_id_idx ON follows (followed_id);

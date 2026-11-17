-- À appliquer sur une base créée avant l'ajout de la colonne (init.sql l'inclut déjà
-- pour les nouvelles bases). Rejouable sans risque.
-- docker exec -i stride_quest_postgres psql -U stride -d stride_quest < database/migrations/001_activities_external_device.sql
ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS external_device VARCHAR(100);

COMMENT ON COLUMN activities.external_device IS
    'Montre d''origine si connue (ex. « Garmin Forerunner 255 »), affichée dans l''historique';

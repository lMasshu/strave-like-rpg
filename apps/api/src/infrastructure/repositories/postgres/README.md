# Guide d'Intégration PostgreSQL / PostGIS (Pôle BDD)

Ce dossier documente les requêtes SQL et l'intégration PostGIS prévues pour l'API REST `apps/api`.

---

## 1. Requêtes Cibles PostGIS

### A. Insertion d'une activité avec son tracé LineString
```sql
INSERT INTO activities (
    id,
    player_id,
    activity_type,
    started_at,
    ended_at,
    distance_meters,
    duration_seconds,
    track
) VALUES (
    $1, -- UUID
    $2, -- UUID (player_id)
    $3, -- 'walk' | 'run' | 'bike' | 'hike'
    $4, -- TIMESTAMPTZ (started_at)
    $5, -- TIMESTAMPTZ (ended_at)
    $6, -- INTEGER (distance_meters)
    $7, -- INTEGER (duration_seconds)
    ST_SetSRID(ST_GeomFromGeoJSON($8), 4326) -- GeoJSON LineString
)
RETURNING id, distance_meters, duration_seconds, ST_AsGeoJSON(track) as track_geojson, created_at;
```

### B. Récupération d'une activité avec conversion GeoJSON
```sql
SELECT 
    id,
    player_id,
    activity_type,
    started_at,
    ended_at,
    distance_meters,
    duration_seconds,
    ST_AsGeoJSON(track)::json as track,
    created_at
FROM activities
WHERE id = $1;
```

### C. Mise à jour atomique de l'XP et du niveau du joueur
```sql
UPDATE players
SET experience = $2,
    level = $3
WHERE id = $1
RETURNING id, username, level, experience, created_at;
```

---

## 2. Bascule vers PostgreSQL

Dès que la base de données est prête :
1. Installer le driver `pg` : `npm install pg @types/pg` dans `apps/api`.
2. Définir `DATABASE_URL=postgres://stride:stride_dev@localhost:5432/stride_quest` dans `.env`.
3. Instancier `PostgresActivityRepository` et `PostgresPlayerRepository` dans `apps/api/src/infrastructure/http/app.ts`.

-- 1. Trouver les raids actifs touchés par une activité (intersection trace GPS / rayon du boss)
SELECT
    r.id AS raid_id,
    r.name,
    r.current_health,
    r.elevation_multiplier
FROM raids r
JOIN activities a ON a.id = $1
WHERE r.status = 'active'
  AND (r.expires_at IS NULL OR r.expires_at > NOW())
  AND ST_DWithin(r.location::geography, a.track::geography, r.radius_meters);

-- 2. Synchroniser les PV du boss en base après décrément Redis (atomique)
UPDATE raids
SET current_health = GREATEST(0, current_health - $1),
    status = CASE WHEN current_health - $1 <= 0 THEN 'completed' ELSE 'active' END
WHERE id = $2 AND status = 'active'
RETURNING id, current_health, status;

-- 3. Enregistrer l'historique des dégâts du joueur
INSERT INTO raid_damage_events (raid_id, player_id, activity_id, damage)
VALUES ($1, $2, $3, $4)
ON CONFLICT (raid_id, activity_id) DO NOTHING;
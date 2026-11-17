-- KEYS[1] = raid:<raid_id>:hp              (String: PV actuels du boss)
-- KEYS[2] = raid:<raid_id>:leaderboard     (Sorted Set: dégâts cumulés par joueur)
-- KEYS[3] = raid:<raid_id>:updates         (Canal Pub/Sub pour le service WebSocket)
-- KEYS[4] = raid:<raid_id>:processed       (Set: IDs des activités déjà traitées - anti-doublon)
--
-- ARGV[1] = damage (int > 0)
-- ARGV[2] = player_id (string)
-- ARGV[3] = activity_id (string)
-- ARGV[4] = raid_id (string)

local damage = tonumber(ARGV[1])
local player_id = ARGV[2]
local activity_id = ARGV[3]
local raid_id = ARGV[4]

-- 1. Anti-doublon (idempotence si RabbitMQ renvoi le même message)
if redis.call('SISMEMBER', KEYS[4], activity_id) == 1 then
    local current = tonumber(redis.call('GET', KEYS[1])) or 0
    return {current, 0, 'ALREADY_PROCESSED'}
end

-- 2. Vérification de l'existence et de l'état du boss
local current_hp = tonumber(redis.call('GET', KEYS[1]))
if not current_hp then
    return {-1, 0, 'NOT_INITIALIZED'}
end

if current_hp <= 0 then
    return {0, 0, 'ALREADY_DEFEATED'}
end

-- 3. Calcul atomique des dégâts réels (jamais de PV négatifs)
local actual_damage = math.min(current_hp, damage)
local new_hp = current_hp - actual_damage

-- 4. Application atomique : décrément PV + classement + marquage activité traitée
redis.call('SET', KEYS[1], new_hp)
redis.call('ZINCRBY', KEYS[2], actual_damage, player_id)
redis.call('SADD', KEYS[4], activity_id)

-- 5. Notification temps réel via Pub/Sub pour le service WebSocket (apps/ws)
local status = new_hp == 0 and 'completed' or 'active'
local event_payload = cjson.encode({
    raidId = raid_id,
    playerId = player_id,
    activityId = activity_id,
    damageDealt = actual_damage,
    remainingHp = new_hp,
    status = status
})
redis.call('PUBLISH', KEYS[3], event_payload)

return {new_hp, actual_damage, status}
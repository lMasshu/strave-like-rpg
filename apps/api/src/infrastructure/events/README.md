# Guide d'Intégration RabbitMQ (Pôle Workers)

L'API REST publie des événements sur l'exchange/queue RabbitMQ dès qu'une activité sportive est validée et enregistrée.

---

## 1. Routing Key : `activity.completed`

### Format du message JSON (Payload) :
```json
{
  "activityId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "playerId": "player-default-001",
  "activityType": "run",
  "distanceMeters": 5200,
  "durationSeconds": 1820,
  "elevationGainMeters": 45,
  "xpEarned": 610,
  "newLevel": 2,
  "timestamp": "2026-11-07T10:35:00.000Z"
}
```

### Rôle pour les `Workers` :
1. Calculer les dégâts infligés au boss de raid actif selon le type d'effort (dénivelé, distance, cadence).
2. Mettre à jour atomiquement les PV du boss dans **Redis** (`DECRBY raid:<id>:hp <damage>`) et insérer un événement dans `raid_damage_events` sous **PostgreSQL**.
3. Déclencher une notification via le **Service WebSocket** (`apps/ws`) pour actualiser la barre de vie en direct sur l'application mobile.

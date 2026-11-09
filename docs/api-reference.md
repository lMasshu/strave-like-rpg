# 📡 Référence Technique API REST & RabbitMQ — Stride Quest

Ce document spécifie les contrats d'API HTTP du microservice `apps/api` (Fastify 5) ainsi que le format des événements distribués via le message broker **RabbitMQ**.

---

## 1. Informations Générales

- **Serveur de développement** : `http://localhost:3000`
- **Format d'échange** : `application/json`
- **Authentification** : 
  - Actuellement via en-tête HTTP `x-player-id: <uuid>` (identifiant par défaut : `player-default-001`).
  - Prévu pour jeton Bearer JWT (`Authorization: Bearer <token>`).

---

## 2. Endpoints HTTP (REST)

### A. Diagnostic & Santé

#### `GET /health`
Vérifie la disponibilité du serveur HTTP.
- **Réponse (200 OK)** :
  ```json
  {
    "status": "ok",
    "service": "stride-quest-api",
    "timestamp": "2026-11-09T10:30:00.000Z"
  }
  ```

---

### B. Profil Joueur

#### `GET /api/players/me`
Récupère le profil du joueur actuellement identifié.
- **En-têtes** : `x-player-id: <uuid>`
- **Réponse (200 OK)** :
  ```json
  {
    "id": "player-default-001",
    "username": "Lucas_Run",
    "level": 2,
    "experience": 1400,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
  ```

#### `GET /api/players/:id`
Récupère le profil public d'un joueur par son identifiant unique.
- **Paramètres d'URL** : `:id` (UUID)
- **Réponse (200 OK)** : structure identique à `/api/players/me`.
- **Réponse (404 Not Found)** :
  ```json
  { "error": "Player not found" }
  ```

---

### C. Activités Sportives

#### `POST /api/activities`
Enregistre une activité terminée, vérifie l'anti-triche, calcule l'XP gagné, met à jour le joueur et publie l'effort sur RabbitMQ.

- **En-têtes** : `x-player-id: <uuid>`, `Content-Type: application/json`
- **Corps de la requête (JSON)** :
  ```json
  {
    "activityType": "run",
    "startedAt": "2026-11-09T09:00:00.000Z",
    "endedAt": "2026-11-09T09:30:00.000Z",
    "durationSeconds": 1800,
    "distanceMeters": 5200,
    "elevationGainMeters": 45,
    "coordinates": [
      [2.3522, 48.8566],
      [2.3530, 48.8575],
      [2.3540, 48.8585]
    ]
  }
  ```
- **Validation Zod** :
  - `activityType` : `'walk' | 'run' | 'bike' | 'hike'` (obligatoire).
  - `startedAt` / `endedAt` : chaîne ISO-8601 valide.
  - `durationSeconds` / `distanceMeters` : entiers positifs ou nuls.
  - `coordinates` : tableau de paires `[longitude, latitude]`.

- **Réponse en cas de succès (201 Created)** :
  ```json
  {
    "activityId": "4a7b9c1d-1234-5678-9abc-def012345678",
    "xpEarned": 610,
    "newLevel": 2,
    "previousLevel": 1,
    "levelUp": true,
    "totalExperience": 1430,
    "distanceMeters": 5200,
    "durationSeconds": 1800
  }
  ```

- **Réponse en cas de rejet Anti-Triche (400 Bad Request)** :
  ```json
  {
    "error": "Anti-cheat validation failed: Excessive speed: 60.0 km/h exceeds maximum plausible limit of 35 km/h for run"
  }
  ```

---

#### `GET /api/activities/me`
Renvoie l'historique des dernières sorties enregistrées du joueur connecté.
- **En-têtes** : `x-player-id: <uuid>`
- **Réponse (200 OK)** :
  ```json
  {
    "activities": [
      {
        "id": "4a7b9c1d-1234-5678-9abc-def012345678",
        "playerId": "player-default-001",
        "activityType": "run",
        "startedAt": "2026-11-09T09:00:00.000Z",
        "endedAt": "2026-11-09T09:30:00.000Z",
        "distanceMeters": 5200,
        "durationSeconds": 1800,
        "elevationGainMeters": 45,
        "coordinates": [[2.3522, 48.8566], [2.3530, 48.8575]],
        "createdAt": "2026-11-09T09:30:05.000Z"
      }
    ]
  }
  ```

#### `GET /api/activities/:id`
Récupère le détail complet d'une activité spécifique par son identifiant.
- **Paramètres d'URL** : `:id` (UUID)
- **Réponse (200 OK)** : objet `Activity`.

---

## 3. Bus d'Événements RabbitMQ

Lors de la validation d'une activité par l'API REST, un événement est automatiquement publié sur RabbitMQ pour alimenter les calculs asynchrones des **Workers** de raid.

### Routing Key : `activity.completed`

#### Format du message JSON (Payload) :
```json
{
  "activityId": "4a7b9c1d-1234-5678-9abc-def012345678",
  "playerId": "player-default-001",
  "activityType": "run",
  "distanceMeters": 5200,
  "durationSeconds": 1800,
  "elevationGainMeters": 45,
  "xpEarned": 610,
  "newLevel": 2,
  "timestamp": "2026-11-09T09:30:00.000Z"
}
```

### Traitement attendu par les Workers (`apps/workers`) :
1. Recherche du ou des Boss de Raid dont la zone géographique d'influence englobe le point de départ de l'activité.
2. Application des multiplicateurs de dégâts :
   - Dégâts de base = distance parcourue en mètres $\times$ multiplicateur de vitesse.
   - Bonus de dénivelé = dénivelé positif ($D+$) $\times$ sensibilité du boss au relief.
3. Décrément atomique des points de vie dans Redis :
   ```bash
   DECRBY raid:<boss_id>:hp <degats_calcules>
   ```
4. Insertion de la ligne d'historique dans la table PostgreSQL `raid_damage_events`.
5. Publication de l'actualisation sur le canal Redis Pub/Sub pour diffusion en direct via le service WebSocket.

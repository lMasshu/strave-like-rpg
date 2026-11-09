# 👥 Guide des Pôles Techniques (SAE) — Stride Quest

Ce document définit les rôles, les responsabilités, les livrables attendus et les contrats d'interfaces entre les différents pôles techniques du groupe **Stride Quest**.

---

## 1. Répartition des Responsabilités par Pôle

### 📱 1. Pôle Frontend / Mobile (`mobile-ionic/`)
- **Périmètre** : Application mobile sous Ionic React 9, React 19, TypeScript 5.8 et Capacitor 8.
- **Missions principales** :
  - Rendu cartographique vectoriel haute performance sous **Mapbox GL JS** (objectif : 60 FPS constants sans saccades GPU).
  - Gestion de la géolocalisation native via `@capacitor/geolocation` (cadence 1000 ms, filtre de précision $\le 25$m, suivi de cap fluide).
  - Interface utilisateur athlétique (Thème sombre *Lime Frost* avec contraste accessible).
  - Interaction avec l'API REST via le client HTTP `src/services/apiClient.ts`.
- **Fichiers clés** :
  - `src/pages/Map.tsx` : écran d'enregistrement sportif et carte interactive.
  - `src/hooks/useActiveWorkout.ts` : machine à états sportive (distance, chrono, allure, tracé GeoJSON).
  - `src/components/QuestRunHud.tsx` : affichage tête haute unifié de quête.
  - `src/services/apiClient.ts` : consommateur de l'API REST.
- **Commandes quotidiennes** :
  ```bash
  npm --prefix mobile-ionic run dev         # Serveur de développement web
  npm --prefix mobile-ionic run test.unit   # Tests unitaires Vitest
  npm --prefix mobile-ionic run lint        # Linter ESLint
  ```

---

### ⚡ 2. Pôle Backend / API REST (`apps/api/`)
- **Périmètre** : Microservice HTTP sous Fastify 5 et TypeScript.
- **Missions principales** :
  - Exposition des routes REST d'authentification, de profils de joueurs et de soumission de courses.
  - Validation stricte des schémas de requêtes via **Zod**.
  - Exécution du moteur **Anti-Triche** synchrone (plafonds de vitesse à 35 km/h course et 90 km/h vélo, cohérence temporelle).
  - Calcul du gain d'expérience (XP) et détection des montées de niveau (*Level Up*).
  - Publication des événements d'activités validées dans le bus **RabbitMQ**.
- **Fichiers clés** :
  - `src/core/services/antiCheatService.ts` : règles de détection de triche et téléportation.
  - `src/core/services/activityService.ts` : calcul d'XP, mise à jour joueur et émission d'événements.
  - `src/infrastructure/http/app.ts` : serveur Fastify et déclaration des routes REST.
  - `src/core/ports/` : interfaces découplées (`IActivityRepository`, `IPlayerRepository`, `IEventPublisher`).
- **Commandes quotidiennes** :
  ```bash
  npm run api:dev      # Lancement avec rechargement automatique (tsx)
  npm run api:test     # Tests d'intégration Fastify
  npm run api:build    # Compilation TypeScript vers dist/
  ```

---

### 🐘 3. Pôle Base de Données (`database/`)
- **Périmètre** : PostgreSQL 16 avec extensions spatiales **PostGIS 3.4** et **pgcrypto**.
- **Missions principales** :
  - Définition et évolution du schéma relationnel (`database/init.sql`).
  - Modélisation géométrique des tracés sous forme `GEOMETRY(LineString, 4326)`.
  - Optimisation des requêtes par index spatiaux **GiST** (`activities_track_gist_idx`).
  - Mise à disposition des fonctions natives PostGIS pour le backend :
    - `ST_DWithin` : détection d'entrée d'un joueur dans le rayon d'un POI ou d'un boss.
    - `ST_Length` : mesure exacte de distance parcourue sur le géoïde terrestre.
- **Guide pour le pôle BDD** :
  - Consultez `apps/api/src/infrastructure/repositories/postgres/README.md` pour les requêtes SQL cibles préparées par le backend.
- **Lancement local** :
  ```bash
  docker compose -f infrastructure/docker-compose.yml up -d postgres
  # Connexion psql locale :
  docker exec -it infrastructure-postgres-1 psql -U stride -d stride_quest
  ```

---

### ⚙️ 4. Pôle Workers & Concurrence (`apps/workers` & RabbitMQ)
- **Périmètre** : Traitement asynchrone des raids sous RabbitMQ et Redis.
- **Missions principales** :
  - Consommation des messages `activity.completed` publiés par l'API REST.
  - Conversion de l'effort physique (kilomètres, vitesse, dénivelé positif) en dégâts bruts infligés au boss.
  - Décrément atomique des points de vie du boss dans **Redis** (`DECRBY raid:<id>:hp <degats>`) pour éviter toute *race condition*.
  - Enregistrement des événements dans la table PostgreSQL `raid_damage_events`.
  - Notification en temps réel du service WebSocket (`apps/ws`) via Redis Pub/Sub.
- **Guide pour le pôle Workers** :
  - Consultez `apps/api/src/infrastructure/events/README.md` pour le format JSON exact des messages reçus.

---

### 🛡️ 5. Pôle Réseau & Infrastructure (`infrastructure/`)
- **Périmètre** : Architecture réseau 2 VM, Nginx, conteneurisation Docker et CI/CD.
- **Missions principales** :
  - Configuration du reverse proxy **Nginx** (routage HTTPS vers `apps/api` et WSS vers `apps/ws`).
  - Mise en place des règles de pare-feu et d'isolation réseau (la VM 2 contenant PostgreSQL et Redis ne doit jamais être exposée publiquement).
  - Maintenance du `docker-compose.yml` local pour l'équipe.
  - Surveillance du pipeline GitHub Actions (`.github/workflows/ci.yml`).

---

## 2. Contrats d'Interfaces & Points de Liaison

| Donnée partagée | Fournisseur | Consommateur | Format / Liaison |
| :--- | :--- | :--- | :--- |
| **Fin de course** | `mobile-ionic` | `apps/api` | `POST /api/activities` (JSON GeoJSON) |
| **Événement d'effort** | `apps/api` | `apps/workers` | RabbitMQ topic `activity.completed` |
| **Tracé spatial** | `apps/api` | `database` | `GEOMETRY(LineString, 4326)` PostGIS |
| **Points de vie du boss** | `apps/workers` | `Redis` / `apps/ws` | Décrément atomique `DECRBY` & Pub/Sub |
| **PV Boss en direct** | `apps/ws` | `mobile-ionic` | WebSocket WSS (événement `boss:damage`) |

---

## 3. Workflow de Collaboration Git & Standards de Qualité

Pour préserver la stabilité du projet sur la branche partagée `develop`, chaque membre de l'équipe applique les règles suivantes :

### A. Nommage des branches
- Format : `<type>/<description-courte-en-minuscules>`
- Exemples :
  - `feat/api-auth-jwt`
  - `feat/raid-damage-worker`
  - `fix/gps-accuracy-filter`
  - `docs/architecture-update`

### B. Conventions de Commit (Conventional Commits en Français)
- Format : `<type>(<scope>): <description concise>`
- **Types valides** : `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`.
- **Scopes habituels** : `mobile`, `api`, `gps`, `carte`, `db`, `infra`, `raid`, `worker`.
- Exemple : `feat(api): validation anti-triche des coordonnees gps`

### C. Checklist Obligatoire avant toute Pull Request
Avant de demander une revue de code à vos camarades :
1. ✅ **Exécuter les tests** : `npm test` doit afficher 100% de succès.
2. ✅ **Vérifier les linters** : `npm run lint` doit renvoyer 0 erreur.
3. ✅ **Vérifier la compilation** : `npm run build && npm run api:build` doit compiler sans erreur.
4. ✅ **Ne jamais commiter de secrets** (tokens Mapbox, clés privées, mots de passe de prod).

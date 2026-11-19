# Directives Agents & Architecture - Stride Quest (strave-like-rpg)

Ce document sert de guide de référence pour tout agent autonome ou développeur intervenant sur le projet **Stride Quest**. Il synthétise la vision produit, l'état de l'existant technique, les règles d'architecture par pôle, ainsi que les standards d'ingénierie logicielle.

---

## 1. Vision Produit & Concept

**Stride Quest** est une application hybride fusionnant le **suivi d'activités sportives géolocalisées** (style Strava) et les **mécaniques de jeu vidéo de rôle et d'exploration** (RPG). L'objectif est d'encourager l'activité physique par la gamification et la coopération communautaire.

Le projet s'articule autour de trois piliers fondamentaux :

### A. Le Cœur "Tracking Sportif"
- **Système de comptes & profils** : Inscription et connexion sécurisées (norme CNIL/ANSSI), niveau du joueur (XP), inventaire de badges, statistiques périodiques (semaine, mois, année), graphique de distance par sport et historique d'activités.
- **Enregistrement en temps réel** : Capture et télémétrie GPS (lat/lng, vitesse, allure, altitude, distance cumulée, chronomètre actif/pause).
- **Dimension sociale** : Sauvegarde et publication des tracés. Ces parcours publics alimentent un catalogue d'« idées de tracés » à proximité pour la communauté (recommandations, kudos, abonnements).

### B. Mécanique d'Exploration (Quêtes Dynamiques)
- **Génération dynamique de Points d'Intérêt (POI)** : Calcul automatique de destinations basé sur la topographie locale (parcs, bois, monuments, intersections sécurisées, chemins ruraux).
- **Génération de parcours intelligents** : Boucles asymétriques anti-aller-retour adaptées à une distance cible demandée par l'utilisateur.
- **Contrainte temporelle** : Compte à rebours calculé dynamiquement selon la distance et une vitesse cible de complétion.
- **Validation sur le terrain** : Détection physique du joueur dans le rayon cible du POI avec confirmation par feedback haptique et mise à jour de l'état de quête.

### C. Mécanique Communautaire (Boss de Raid)
- **Boss géo-localisés multi-échelles** : Entités apparaissant à l'échelle locale (ville), régionale/nationale ou mondiale.
- **Coopération asynchrone massive** : Tout effort physique valide enregistré dans la zone géographique d'influence du boss est converti en « dégâts » réduisant ses points de vie globaux (HP).
- **Profils & stats des monstres** : HP colossaux, résistances à certains types d'efforts (ex. sensibilité au dénivelé, à la course rythmée ou à la marche longue).
- **Événements & récompenses** : Si le boss est vaincu avant la date limite, tous les contributeurs reçoivent de l'expérience et des badges exclusifs affichés sur leur profil.

---

## 2. Organisation du Dépôt & État de l'Existant

Le dépôt est structuré en monorepo :

```text
strave-like-rpg/
├── mobile-ionic/           # Application mobile front-end (Ionic React 9 + Vite 8)
│   ├── src/
│   │   ├── auth/           # Contexte d'authentification (AuthProvider, authForm, sessionStorage)
│   │   ├── components/     # Composants UI (ProfileTabs, ProfileStatsPanel, ErrorBoundary, QuestRunHud...)
│   │   ├── hooks/          # Hooks React (useGeolocationTracker, useQuestRun, useWatchLink...)
│   │   ├── services/       # Services métier (apiClient, geo, questGenerator, watchSync, playerLevel...)
│   │   ├── pages/          # Écrans (AuthPage, Home, Map, Profile, Settings, Notifications)
│   │   └── data/           # Types et données partagées
│   └── vite.config.ts      # Configuration Vite & Vitest
├── apps/
│   └── api/                # Backend REST API Fastify 5 + TypeScript
│       ├── src/
│       │   ├── core/       # Entités métier (Player, Activity), services (authService, activityService)
│       │   ├── infrastructure/ # Dépôts PostgreSQL natifs, vérificateur Auth0, routes HTTP Fastify
│       │   └── index.ts    # Point d'entrée du serveur API (port 3000)
│       └── .env.example    # Configuration d'environnement backend
├── database/               # Schémas relationnels et extensions spatiales
│   ├── init.sql            # Initialisation PostGIS (players, raids, activities, raid_damage_events)
│   ├── seed.sql            # Données de démonstration et comptes de test
│   └── migrations/         # Migrations incrémentales (ex: 001_activities_external_device.sql)
├── infrastructure/         # Définition des environnements conteneurisés
│   └── docker-compose.yml  # Services PostgreSQL 16 (PostGIS 3.4) et Redis 7
├── packages/               # Contrats d'interfaces partagés (types DTO, contrats d'API)
└── .github/workflows/      # Intégration continue (ESLint, Prettier, Vitest, build Vite & API)
```

### Stack Technique en Place :
- **Mobile** : React 19, Ionic React 9, TypeScript 5.8, Vite 8, Mapbox GL 3.32, Capacitor 8 (Geolocation, Haptics, App, Status-bar, Health Connect).
- **Backend API** : Node.js 22+, Fastify 5, Zod 3, Jose (JWKS Auth0), @fastify/jwt, @fastify/rate-limit, pg 8.
- **Base de Données** : PostgreSQL 16 avec extensions PostGIS 3.4, `citext` et `pgcrypto`.
- **Cache & Concurrence** : Redis 7 (Alpine).
- **Qualité & Tests** : ESLint 9, Prettier 3, Vitest 3 & 4 (460+ tests unitaires automatisés).

---

## 3. Directives d'Ingénierie par Pôle Technique

### 1. Pôle Développement (Dev) - Frontend & Logique Métier

#### Authentification & Sécurité (Règles Critiques) :
- **Norme des mots de passe (CNIL / ANSSI / OWASP)** :
  - **12 caractères minimum** exigés à l'inscription.
  - Au moins 1 lettre majuscule, 1 lettre minuscule, 1 chiffre et 1 caractère spécial (`[^A-Za-z0-9]`).
  - Validation stricte des deux côtés : schéma Zod `registerSchema` dans `apps/api` et validateur `evaluatePassword()` dans `mobile-ionic`.
  - **Indicateur visuel dynamique** : sous le champ mot de passe, jauge de force dynamique (Très faible / Moyen / Solide / Conforme) et checklist interactive réactive à la frappe.
- **Sessions & Tokens signés** :
  - Signature obligatoire par jeton JWT signé avec `JWT_SECRET` (32 caractères minimum requis).
  - Interdiction totale des faux en-têtes non vérifiés (ex. ancien header `x-player-id`).
- **Connexion Google via Auth0** :
  - Vérification cryptographique de l'ID token côté serveur via le JWKS du tenant Auth0 (`Auth0IdentityVerifier` avec `jose`). Aucune confiance aveugle dans le payload client.
- **Hachage des mots de passe** :
  - Utilisation de `scrypt` avec sel unique aléatoire et paramètres calibrés (`N=32768, r=8, p=1`).

#### Frontend / Mobile (`mobile-ionic/`) :
- **Maître de Guilde (Coach IA & Suivi de progression)** :
  - Modal immersif `<GuildMasterModal>` accessible depuis l'Accueil (`Home.tsx`) et les Paramètres (`Settings.tsx`).
  - Section de configuration `<CoachSettingsSection>` avec bascule d'activation (opt-in) et sélection de l'objectif sportif (`casual`, `active`, `5k`, `10k`, `half-marathon`, `marathon`).
  - Gestion hors-ligne et résilience : si Ollama est indisponible, l'application reste fluide et propose un message explicatif sans bloquer l'expérience sportive.
  - **Support Mode Sombre Bimodal** : isolation stricte des palettes (`lime-frost` ne doit pas forcer de fond clair) et règles sombres dédiées (`[data-theme="dark"]`, `.ion-palette-dark`) pour éliminer tout flash blanc ou carte blanche résiduelle.
- **Isolation des Formulaires (Anti-conflit Autofill)** :
  - Utiliser systématiquement une clé React propre au mode (`key={mode}` sur `<form>`, et `key={isRegister ? "reg-pwd" : "login-pwd"}` sur l'input) pour forcer le démontage/remontage DOM propre.
  - En mode Connexion, `autoComplete="current-password"` et `name="password"` pour que le navigateur propose les identifiants enregistrés sans suggérer de mot de passe généré.
- **Résilience UI & Bouclier Anti-Vibecode** :
  - Envelopper les écrans majeurs dans `<ErrorBoundary>` pour prévenir les écrans blancs en cas d'erreur de rendu.
  - Respecter la charte graphique sobre (vert athlétique Stride Quest `#65a30d`, pas de dégradés violets génériques, pas de glassmorphism excessif détruisant le contraste WCAG AA).
  - Gérer systématiquement les 4 états de vie : chargement avec skeleton animé, succès hiérarchisé, état vide accueillant, état d'erreur avec bouton de réessai.
- **Montres Connectées (`@capgo/capacitor-health`)** :
  - Liaison en lecture seule Health Connect / Apple Santé.
  - Synchronisation automatique et dédoublonnée des séances de montre (`watchSync.ts`).

#### Backend & Logique Métier (`apps/api`) :
- **Architecture & Ports/Adapters** :
  - Séparation stricte entre le Core métier (`entities`, `services`, interfaces de `ports`) et l'Infrastructure (`repositories/postgres`, `http/app.ts`).
  - Dépôts PostgreSQL natifs avec `pg.Pool`. En l'absence de `DATABASE_URL`, repli transparent sur les dépôts en mémoire pour les tests unitaires.
- **Maître de Guilde (Service LLM Local & Souverain)** :
  - Intégration d'Ollama (`mistral:7b` recommandé par défaut pour sa pertinence en français et sa logique d'instructions, ou `llama3.2:3b` pour contrainte CPU stricte) via `OllamaClient` avec timeout calibré (120s), température resserrée (`0.3`), pénalité de répétition (`repeat_penalty: 1.15`) et repli heuristique autonome.
  - **Sobriété de Réponse & Pertinence Contextuelle** : le prompt n'injecte plus d'exemples rigides de templates qui provoquaient des fuites de méta-consignes et des plans de semi-marathon sur des questions simples (comme "2+2"). Les questions non sportives ou simples sont répondues en une phrase concise, et un programme n'est déployé que sur demande explicite.
  - **Ancrage Temporel Dynamique** : injection de la date du jour réelle (`toLocaleDateString('fr-FR')`) dans le prompt système pour garantir la justesse des calculs d'échéances et de calendrier d'entraînement (ex: délai avant une course cible).
  - **Streaming Temps Réel (Server-Sent Events / SSE)** :
    - Route dédiée `POST /api/coach/messages/stream` : transmission progressive des tokens générés par Ollama (`stream: true`) au client mobile.
    - **Time To First Token (TTFT) < 1,8 s** : l'utilisateur commence à lire immédiatement pendant que le modèle génère le reste de la réponse sous ses yeux, éliminant totalement la sensation d'attente sur écran figé.
    - Le plafond artificiel de tokens (`num_predict`) est desserré (`1000 tokens`) : les programmes complets ne sont plus jamais coupés.
    - Persistance atomique à la fin du flux dans `coach_messages`.
  - **Routage d'Intention & Anti-Contamination (Latence < 2s sur questions simples)** :
    - Classification de l'intention en amont dans `coachService.ts` :
      1. *Générale / Hors-sport / Calcul* (ex: "2+2", "bonjour") : prompt minimaliste sans injection de profil running -> réponse en ~1,9s (10-15 tokens) au lieu de 50s.
      2. *Conseil Running / Récupération* (douleurs, nutrition, équipement) : prompt ciblé conseil sans structure de plan -> réponse bienveillante en 10-15s sans parasitage.
      3. *Programme d'Entraînement Explicite* : cadrage strict (Foncier, Spécifique, Affûtage, max 3 séances/semaine, plafond de sortie longue à 18 km pour semi / 32 km pour marathon).
  - **Persistance en RAM (keep_alive)** : maintien du modèle chargé en mémoire vive (`keep_alive: '60m'`) pour éliminer le délai de rechargement SSD de 9s à chaque requête.
  - **Évaluation Paresseuse (Lazy Evaluation)** : les bilans hebdomadaires sont calculés à la demande lors de la première consultation de la semaine et mis en cache dans `coach_weekly_reports` (zéro appel LLM inutile).
  - **Sobriété de Stockage & Rétention Stricte** : l'historique de discussion est automatiquement purgé au-delà des 30 derniers messages (`purgeOldMessages(playerId, 30)`), garantissant un coût de stockage minime (~15 Ko max par joueur).
- **Anti-Triche & Validation GPS** :
  - Vérification de vélocité maximale (35 km/h à pied, 90 km/h à vélo) et détection des téléportations instantanées.

---

### 2. Pôle Base de Données (BD) - Données Spatiales & Concurrence

#### Modélisation Spatiale & Schéma PostgreSQL :
- **Table `players`** :
  - `email CITEXT NOT NULL UNIQUE` (insensible à la casse natif PostgreSQL).
  - `password_hash TEXT` (hash scrypt, `NULL` si compte Google pur).
  - `auth0_sub VARCHAR(255) UNIQUE`.
- **Table `activities`** :
  - Tracé projeté `GEOMETRY(LineString, 4326)` avec index GiST (`CREATE INDEX ... USING GIST (track);`).
  - Dédoublonnage montre connectée : contrainte unique `activities_external_ref_uniq` sur `(player_id, external_source, external_id)`.
- **Table `raids` & Dégâts Atomiques** :
  - Calcul de distance spatiale native PostGIS (`ST_DWithin`, `ST_Length(geography(track))`).
  - **Interdiction formelle** d'un `SELECT` suivi d'un `UPDATE` non verrouillé pour les PV du boss :
    ```sql
    UPDATE raids
    SET current_health = GREATEST(0, current_health - $1)
    WHERE id = $2 AND status = 'active'
    RETURNING current_health, status;
    ```
- **Tables `coach_weekly_reports` & `coach_messages`** :
  - Unicité du bilan par joueur et semaine : `UNIQUE (player_id, year, week_number)`.
  - Index antéchronologique sur `coach_messages (player_id, created_at DESC)` pour lecture et purge rapide des 30 messages.

#### Gestion des Migrations & Seed :
- Les nouvelles tables et colonnes doivent être ajoutées dans `database/init.sql` pour les nouvelles bases, et sous forme de script incrémental dans `database/migrations/` (ex. `002_coach_guild_master.sql`) pour les bases existantes.
- Ne jamais commiter de données de production dans `database/seed.sql`.

---

### 3. Pôle Réseau & Système (Infra) - Télémétrie, Rate Limiting & Scalabilité

- **Rate Limiting** :
  - Protection des routes d'authentification (`/api/auth/login`, `/api/auth/register`) et de dialogue IA (`/api/coach/messages`) via `@fastify/rate-limit`.
- **Variables d'Environnement** :
  - Backend (`apps/api/.env`) : `DATABASE_URL`, `JWT_SECRET`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `OLLAMA_URL`, `OLLAMA_MODEL`, `PORT`, `HOST`.
  - Frontend (`mobile-ionic/.env`) : `VITE_API_URL`, `VITE_MAPBOX_TOKEN`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`.
- **Conteneurs Docker** :
  - PostgreSQL / PostGIS 16 (port hôte 5432).
  - Redis 7 Alpine (port hôte 6379).
  - Ollama (port hôte 11434, volume `ollama_data`).

---

## 4. Standards de Développement & Conventions pour les Agents

Toute contribution de code par un agent doit scrupuleusement respecter les règles suivantes :

1. **Documentation Vivante (`AGENTS.md`)** :
   - Tout agent modifiant une architecture, ajoutant une commande essentielle ou instaurant un nouveau standard (sécurité, validation, schéma BD) doit **proactivement mettre à jour ce document `AGENTS.md`** dans sa livraison.

2. **TypeScript Strict & Typage aux Frontières** :
   - Typage explicite des paramètres, retours de fonctions et structures de données. Aucun `any` implicite.
   - Validation systématique à l'exécution avec des schémas Zod aux frontières (API REST, formulaires).

3. **Tests Automatisés Systématiques** :
   - Tout nouveau service, endpoint ou composant sensible **doit** s'accompagner d'un fichier de test unitaire Vitest (`*.test.ts` ou `*.test.tsx`).
   - Le build et l'intégralité des tests doivent passer au vert avant de considérer une tâche terminée.

4. **Protocole de Validation CI Pré-Push OBLIGATOIRE (Zéro échec toléré)** :
   - Avant TOUT commit ou push, exécuter **intégralement** la chaîne de vérification CI locale :
     1. `npm --prefix mobile-ionic run format` puis `npm --prefix mobile-ionic run format:check` (Prettier)
     2. `npm --prefix mobile-ionic run lint` (ESLint)
     3. `npm --prefix mobile-ionic run test.unit -- --run` (Vitest frontend)
     4. `npm --prefix mobile-ionic run build` (Vite build)
     5. `npm run api:build` (TypeScript backend)
     6. `npm run api:test` (Vitest backend)
   - Interdiction formelle de commiter ou pousser si la moindre étape échoue ou renvoie un warning.

5. **Style, Formatage & Conventions Git** :
   - Prettier (`npm --prefix mobile-ionic run format`) et ESLint (`npm run lint`).
   - Commits : Conventional Commits en français : `<type>(<scope>): <description concise en minuscules>`.
   - Branches : GitFlow (`feature/...`, `fix/...`). Ne jamais commiter de secrets (`.env`).

---

## 5. Commandes Essentielles

| Action | Commande |
| :--- | :--- |
| **Démarrage Infrastructure (Docker)** | `docker compose -f infrastructure/docker-compose.yml up -d` |
| **Démarrage Backend API (Port 3000)** | `npm run api:dev` *(ou `npm --prefix apps/api run dev`)* |
| **Démarrage Frontend Mobile (Port 5173)** | `npm run dev` *(ou `npm --prefix mobile-ionic run dev`)* |
| **Tests Unitaires Complets (Mono-repo)** | `npm run test` |
| **Tests Unitaires Frontend (Vitest)** | `npm --prefix mobile-ionic run test.unit -- --run` |
| **Tests Unitaires Backend (Vitest)** | `npm run api:test` *(ou `npm --prefix apps/api run test`)* |
| **Compilation TypeScript Backend** | `npm run api:build` *(ou `npm --prefix apps/api run build`)* |
| **Compilation TypeScript & Vite Frontend** | `npm run build` *(ou `npm --prefix mobile-ionic run build`)* |
| **Linter ESLint** | `npm run lint` *(ou `npm --prefix mobile-ionic run lint`)* |
| **Formatage Prettier** | `npm --prefix mobile-ionic run format` |
| **Initialisation BDD PostGIS (PowerShell)** | `Get-Content database/init.sql \| docker exec -i infrastructure-postgres-1 psql -U stride -d stride_quest` |
| **Chargement Jeu de Test / Seed (PowerShell)**| `Get-Content database/seed.sql \| docker exec -i infrastructure-postgres-1 psql -U stride -d stride_quest` |
| **Vérification Workflow Complet** | Utiliser le skill `@commit-push` |

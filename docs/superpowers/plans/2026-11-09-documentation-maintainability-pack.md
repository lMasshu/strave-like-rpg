# Pack Documentation & Maintenabilité Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Concevoir une documentation technique et opérationnelle complète (README vitrine, architecture 2 VM, guides des pôles SAE, procédure de compilation Android APK, référence API/RabbitMQ et JSDoc du code critique) pour garantir la maintenabilité du projet et valoriser sa rigueur technique auprès des évaluateurs.

**Architecture:** Approche modulaire scindant la vitrine d'accueil (`README.md`), les guides spécialisés dans `docs/` (`architecture.md`, `guide-poles.md`, `build-android.md`, `api-reference.md`) et l'enrichissement JSDoc des services clés du mobile et du backend.

**Tech Stack:** Markdown GitHub-flavored, Fastify 5, React 19 / Ionic 9, Capacitor 8, PostgreSQL/PostGIS, Redis, RabbitMQ, Gradle / OpenJDK 21.

**Spec:** `docs/superpowers/specs/2026-11-09-documentation-maintainability-pack-design.md`

## Global Constraints

- Respecter scrupuleusement la charte et les conventions de commit du projet (`AGENTS.md`).
- Chaque commande documentée (bash, npm, adb, gradlew) doit être testée et fonctionnelle sur l'environnement réel du dépôt.
- Aucune régression sur la suite de 152 tests automatisés existants (`npm test`).
- Zéro dérive de formatage : validation par `npm run lint`.

## Review Focus

- Validation de la clarté des commandes pour un évaluateur technique clonant le dépôt pour la première fois.
- Cohérence absolue entre les DTOs TypeScript réels (`SaveActivityDto`, `ActivitySaveResult`) et la documentation dans `docs/api-reference.md`.
- Exactitude des chemins de fichiers et des commandes de build Android sous Windows/WSL.
- Lisibilité des diagrammes ASCII pour l'architecture réseau et le cycle de vie d'une course.
- Vérification que la documentation valorise les 152 tests automatisés et les règles anti-triche.

---

### Task 1: Refonte Complète du `README.md` Racine

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `package.json`, `apps/api`, `mobile-ionic`, `database/init.sql`, `infrastructure/docker-compose.yml`.
- Produces: Le point d'entrée principal du dépôt avec badges, pitch, démarrage rapide, architecture globale et liens vers `docs/`.

- [ ] **Step 1: Rédiger le nouveau `README.md`**
  - Titre, pitch accrocheur de Stride Quest.
  - Badges de qualité (Tests: 152 passés, TypeScript 5.8+, Fastify, Capacitor, PostGIS).
  - Présentation des fonctionnalités clés (Tracking GPS 1000ms, Quêtes procédurales, Raids mondiaux, Anti-triche).
  - Schéma textuel simplifié de l'architecture 2 VM.
  - Section "Démarrage Rapide" (Mobile, API, BDD Docker, Lancement des tests).
  - Sommaire pointant vers les documents spécialisés dans `docs/`.
- [ ] **Step 2: Vérifier le rendu et les liens**
  - Vérifier que les liens relatifs vers `docs/` et les commandes `npm` correspondent aux scripts réels de `package.json`.
- [ ] **Step 3: Commiter le README**
  - Commit : `docs(readme): refonte complete du README d'accueil avec architecture et demarrage rapide`

---

### Task 2: Guide d'Architecture & Flux de Données (`docs/architecture.md`)

**Files:**
- Create: `docs/architecture.md`

**Interfaces:**
- Consumes: Diagramme d'architecture 2 VM, schéma `database/init.sql`, directives de `AGENTS.md`.
- Produces: Référence technique exhaustive sur le découpage réseau, la VM1 applicative, la VM2 données, les flux HTTPS/WSS et les mécanismes anti-triche et concurrence.

- [ ] **Step 1: Rédiger `docs/architecture.md`**
  - Diagramme d'architecture réseau 2 VM complet.
  - Rôle de chaque service : Nginx, API REST (`apps/api`), Service WebSocket (`apps/ws`), Broker RabbitMQ, Workers de raid (`apps/workers`), PostgreSQL/PostGIS et Redis.
  - Flux d'une activité sportive : de la capture GPS sur le smartphone à la réduction des HP du boss de raid via RabbitMQ et Redis.
  - Mécanisme Anti-triche : seuils de vitesse pédestre/cycliste et contrôle de consistance temporelle.
  - Gestion de la concurrence massive : opérations atomiques SQL et décompte temps réel dans Redis.
- [ ] **Step 2: Vérifier la cohérence technique**
  - Valider l'alignement avec les schémas existants de `database/init.sql` et le code de `apps/api`.
- [ ] **Step 3: Commiter**
  - Commit : `docs(arch): guide detaille de l'architecture reseau 2 VM et des flux de donnees`

---

### Task 3: Guide de Collaboration des Pôles SAE (`docs/guide-poles.md`)

**Files:**
- Create: `docs/guide-poles.md`

**Interfaces:**
- Consumes: Organisation des dossiers (`mobile-ionic`, `apps/api`, `database`, `infrastructure`).
- Produces: Guide pratique d'onboarding et de répartition des responsabilités pour les 4 pôles du projet.

- [ ] **Step 1: Rédiger `docs/guide-poles.md`**
  - Découpage par pôle :
    1. **Pôle Frontend / Mobile** : Responsabilités (`mobile-ionic/`), tests Vitest/Cypress, règles de performance cartographique 60 FPS.
    2. **Pôle Backend / API REST** : Architecture hexagonale (`apps/api/`), endpoints, ports/adaptateurs.
    3. **Pôle Base de Données** : Schémas spatiaux (`database/init.sql`), requêtes PostGIS cibles, indexation GiST.
    4. **Pôle Workers & Concurrence** : Consommation de RabbitMQ, calcul des dégâts de raid, mise à jour atomique Redis.
    5. **Pôle Infra & Réseau** : Configuration Nginx, conteneurisation Docker, exposition des VM.
  - Règles Git d'équipe : conventions de nommage de branches (`feat/`, `fix/`), Conventional Commits en français, checklist avant Pull Request.
- [ ] **Step 2: Commiter**
  - Commit : `docs(team): guide d'organisation et contrats d'interfaces entre poles`

---

### Task 4: Guide de Build & Déploiement Android (`docs/build-android.md`)

**Files:**
- Create: `docs/build-android.md`

**Interfaces:**
- Consumes: `mobile-ionic/android/`, `mobile-ionic/capacitor.config.ts`, `gradle.properties`.
- Produces: Procédure complète et testée de génération de l'APK debug et release.

- [ ] **Step 1: Rédiger `docs/build-android.md`**
  - Prérequis système (Android Studio, SDK Platform 36, OpenJDK 21).
  - Gestion des spécificités Windows / WSL (chemins `cmd.exe`, `org.gradle.java.home`).
  - Cycle complet de build en 3 étapes :
    1. Build web : `npm --prefix mobile-ionic run build`
    2. Sync Capacitor : `npx cap sync android`
    3. Compilation native : `cmd.exe /c "gradlew.bat assembleDebug"`
  - Installation sur appareil physique via ADB : `adb install -r ...`
  - Dépannage des erreurs fréquentes (Daemon Java release 21, autorisations GPS précises).
- [ ] **Step 2: Commiter**
  - Commit : `docs(android): procedure pas-a-pas de compilation et de deploiement de l'APK`

---

### Task 5: Référence Technique de l'API & Événements (`docs/api-reference.md`)

**Files:**
- Create: `docs/api-reference.md`

**Interfaces:**
- Consumes: `apps/api/src/infrastructure/http/app.ts`, `apps/api/src/core/entities/`.
- Produces: Documentation exhaustive des endpoints HTTP et du bus d'événements RabbitMQ.

- [ ] **Step 1: Rédiger `docs/api-reference.md`**
  - Spécification des routes REST :
    - `GET /health` : diagnostic serveur.
    - `GET /api/players/me` : profil du joueur connecté.
    - `POST /api/activities` : soumission d'une course, payload GeoJSON, validation Zod, calcul XP.
    - `GET /api/activities/me` : historique des activités.
    - `GET /api/activities/:id` : détail complet d'une activité.
  - Spécification des événements RabbitMQ :
    - Événement `activity.completed` (payload, exchange, rôle pour les workers).
- [ ] **Step 2: Commiter**
  - Commit : `docs(api): reference exhaustive des routes REST Fastify et des messages RabbitMQ`

---

### Task 6: Documentation du Code Source (JSDoc) & Vérification Qualité

**Files:**
- Modify: `apps/api/src/core/services/antiCheatService.ts`
- Modify: `apps/api/src/core/services/activityService.ts`
- Modify: `mobile-ionic/src/hooks/useActiveWorkout.ts`
- Modify: `mobile-ionic/src/services/apiClient.ts`

**Interfaces:**
- Consumes: Services existants du backend et du frontend.
- Produces: Code auto-documenté via JSDoc strict pour IDE (VS Code, WebStorm) et maintenabilité long terme.

- [ ] **Step 1: Ajouter les annotations JSDoc sur `antiCheatService.ts` et `activityService.ts`**
  - Documenter les règles de vélocité, les formules d'XP et les flux d'événements.
- [ ] **Step 2: Ajouter les annotations JSDoc sur `useActiveWorkout.ts` et `apiClient.ts`**
  - Documenter la machine à états de course, les calculs télémétriques Haversine et la gestion des erreurs réseau.
- [ ] **Step 3: Lancer les vérifications complètes**
  - Exécuter `npm test` (152 tests verts attendus).
  - Exécuter `npm run lint`.
  - Exécuter `npm run build` et `npm run api:build`.
- [ ] **Step 4: Commiter**
  - Commit : `docs(code): ajout annotations JSDoc sur les services critiques mobile et backend`

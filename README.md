# 🏃‍♂️ Stride Quest — Hybrid Sport Tracking & RPG

[![Tests](https://img.shields.io/badge/tests-152%20passed-brightgreen.svg)](https://github.com/lMasshu/strave-like-rpg)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Ionic](https://img.shields.io/badge/Ionic%20React-9.0-3880ff.svg)](https://ionicframework.com/)
[![Fastify](https://img.shields.io/badge/Fastify-5.2-000000.svg)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostGIS-16--3.4-336791.svg)](https://postgis.net/)
[![Redis](https://img.shields.io/badge/Redis-7-dc382d.svg)](https://redis.io/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.5-119eff.svg)](https://capacitorjs.com/)

> **Stride Quest** est une application hybride fusionnant le **suivi d'activités sportives géolocalisées** (style Strava) et les **mécaniques de jeu vidéo de rôle et d'exploration** (RPG). L'objectif est d'encourager la pratique physique par la gamification, l'exploration du territoire et la coopération communautaire.

---

## 🌟 Les 3 Piliers du Jeu

| Pilier | Description | Fonctionnalités Clés |
| :--- | :--- | :--- |
| **A. Cœur Tracking Sportif** | Capture télémétrique en temps réel et tableau de bord de progression. | Cadence GPS 1000 ms, filtre anti-bruit (précision $\le 25$m), vitesse, dénivelé positif, calcul d'allure et tracé dynamique WebGL 60 FPS. |
| **B. Quêtes d'Exploration** | Génération procédurale d'objectifs et de boucles sportives adaptées. | Détection de POI locaux (monuments, parcs, chemins), boucles asymétriques anti-aller-retour, compte à rebours dynamique et validation haptique. |
| **C. Raids Communautaires** | Boss mondiaux et régionaux combattus collectivement en asynchrone. | Les kilomètres et le dénivelé enregistrés dans la zone d'influence du boss réduisent ses points de vie (HP) partagés en direct. |

---

## 🏛️ Architecture Réseau Distribuée (2 VM)

L'infrastructure applicative est conçue selon une architecture distribuée à 2 machines virtuelles pour séparer l'exposition publique et la sécurité des données :

```text
               ┌───────────────────────────────┐
               │  Stride Quest (Mobile Ionic)  │
               └──────────────┬────────────────┘
                              │ HTTPS / WSS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  VM 1 : Applicative (Seule exposée sur Internet)            │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              Nginx (Reverse Proxy & TLS)            │   │
│   └───────────────┬─────────────────────────────┬───────┘   │
│           HTTPS   │                       WSS   │           │
│                   ▼                             ▼           │
│   ┌───────────────────────────────┐   ┌─────────────────┐   │
│   │   API REST (apps/api)         │   │ Service         │   │
│   │   - Fastify 5 & TypeScript    │   │ WebSocket       │   │
│   │   - Auth, validation & XP     │   │ - PV Boss live  │   │
│   │   - Moteur Anti-Triche        │   └────────┬────────┘   │
│   └───────────────┬───────────────┘            │            │
│                   │ Publish                    │            │
│                   ▼                            │            │
│           [ RabbitMQ (Broker) ]                │            │
│                   │ Consume                    │            │
│                   ▼                            │            │
│   ┌───────────────────────────────┐            │            │
│   │   Workers de Raid             │            │            │
│   │   - Calcul des dégâts boss    │            │            │
│   └───────────────┬───────────────┘            │            │
└───────────────────┼────────────────────────────┼────────────┘
                    │                            │
════════════════════╪════════════════════════════╪═════════════
                    │ Privé                      │ Privé
┌───────────────────┼────────────────────────────┼────────────┐
│  VM 2 : Données   ▼                            ▼            │
│   ┌───────────────────────────────┐   ┌─────────────────┐   │
│   │   PostgreSQL 16 / PostGIS 3.4 │   │   Redis 7       │   │
│   │   - Tracés LineString 4326    │   │   - PV Boss     │   │
│   │   - Joueurs & Activités       │   │   - Pub/Sub     │   │
│   └───────────────────────────────┘   └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Démarrage Rapide

### Prérequis
- **Node.js** : v20 ou supérieur (`node -v`)
- **Docker & Docker Compose** : pour la base de données locale
- **Android Studio & OpenJDK 21** : pour la compilation mobile native Android

### 1. Cloner et installer les dépendances
```bash
git clone https://github.com/lMasshu/strave-like-rpg.git
cd strave-like-rpg

# Installer les dépendances du mobile et de l'API
npm --prefix mobile-ionic install
npm --prefix apps/api install
```

### 2. Démarrer les bases de données (Docker)
```bash
docker compose -f infrastructure/docker-compose.yml up -d
```
*Services lancés : PostgreSQL 16 avec extension PostGIS (`localhost:5432`) et Redis 7 (`localhost:6379`).*

### 3. Lancer l'API REST en développement
```bash
npm run api:dev
```
*L'API REST Fastify démarre sur `http://localhost:3000`. Diagnostic : `http://localhost:3000/health`.*

### 4. Lancer l'Application Mobile (Web Dev)
```bash
npm run dev
```
*L'interface Ionic s'ouvre sur `http://localhost:5173`.*

---

## 🧪 Tests Automatisés & Qualité

Le projet intègre une suite de tests unitaires et d'intégration automatisés exécutée systématiquement en Intégration Continue (CI) :

```bash
# Lancer la suite unifiée (Mobile 141 tests + API 11 tests = 152 tests)
npm test

# Lancer les linters ESLint
npm run lint

# Vérifier la compilation TypeScript de tous les projets
npm run build && npm run api:build
```

---

## 📱 Compilation Android (APK)

L'application mobile se compile en binaire Android natif via **Capacitor 8** :

```bash
# 1. Compiler les assets web
npm run build

# 2. Synchroniser le projet natif Android
npx --prefix mobile-ionic cap sync android

# 3. Compiler l'APK Debug (via Gradle)
cd mobile-ionic/android
cmd.exe /c "gradlew.bat assembleDebug"   # Sous Windows / WSL
./gradlew assembleDebug                 # Sous Linux natif
```
*L'APK généré est disponible dans : `mobile-ionic/android/app/build/outputs/apk/debug/app-debug.apk`.*  
Consultez le [Guide de Build Android](docs/build-android.md) pour les détails complets.

---

## 📚 Documentation Détaillée

Pour approfondir le fonctionnement du projet, consultez nos guides spécialisés :

- 📐 **[Architecture Réseau & Flux de Données](docs/architecture.md)** : Fonctionnement détaillé des 2 VM, anti-triche et concurrence.
- 👥 **[Guide des Pôles Techniques (SAE)](docs/guide-poles.md)** : Organisation, rôles (Dev, BDD, Workers, Infra) et contrats d'interfaces.
- 🤖 **[Guide de Compilation Android](docs/build-android.md)** : Procédure pas-à-pas, configuration Java 21 et déploiement ADB.
- 📡 **[Référence API REST & RabbitMQ](docs/api-reference.md)** : Spécification des endpoints Fastify et format des messages de file.
- 📋 **[Directives d'Architecture & Conventions (AGENTS.md)](AGENTS.md)** : Standards de code, TypeScript strict et conventions de commit.

---

## 👥 Équipe & Contexte

Projet réalisé dans le cadre de la **SAE Stride Quest**.

- **Frontend / Mobile** : Ionic React, Mapbox GL JS, Capacitor.
- **Backend / API** : Fastify, TypeScript, Zod, RabbitMQ.
- **Base de Données** : PostgreSQL 16, PostGIS 3.4, Redis 7.
- **Système & Réseau** : Nginx, Docker, architecture 2 VM privées/publiques.

# Pack Documentation & Maintenabilité - Design Doc

**Auteur :** Antigravity & Équipe Stride Quest  
**Date :** 2026-11-09  
**Statut :** Approuvé  

---

## 1. Contexte & Intention

Le projet **Stride Quest** (application hybride sport / RPG) dispose d'une application mobile riche (`mobile-ionic`), d'une base de données relationnelle spatiale (`PostgreSQL / PostGIS / Redis`), d'une infrastructure conteneurisée (`docker-compose.yml`) et d'un nouveau microservice backend REST (`apps/api`). 

Cependant, la documentation actuelle souffre de plusieurs manques :
- Le `README.md` racine est incomplet, obsolète (36 lignes, pas de mention d'`apps/api` ni d'Android) et ne valorise pas l'architecture à 2 VM récemment validée.
- Les membres du groupe (Dev mobile, Backend, BDD, Workers, Infra) manquent d'un guide commun définissant les frontières de chaque pôle et leurs contrats d'interfaces.
- La compilation Android sous WSL/Windows (spécificités Java 21, Gradle, Capacitor) n'est pas documentée.
- Les endpoints de l'API REST et les événements RabbitMQ manquent d'une référence centralisée.

## 2. Objectifs

1. **Vitrine & Onboarding (`README.md`)** :
   - Présentation claire du concept produit et de la boucle de gameplay (sport + RPG).
   - Schéma textuel/ASCII de l'architecture réseau 2 VM.
   - Commandes express pour démarrer (Mobile, API, Tests unifiés, Docker, Android).
   - Tableau des technologies et justification des choix techniques.
2. **Guide d'Architecture (`docs/architecture.md`)** :
   - Description complète de la VM1 (Nginx, API REST, WebSocket, Workers, RabbitMQ) et de la VM2 (PostgreSQL/PostGIS, Redis).
   - Flux de données HTTPS et WSS.
   - Modèle anti-triche (règles de vélocité) et résolution des accès concurrents aux PV des boss de raid (Redis atomique / PostGIS).
3. **Guide des Pôles Techniques (`docs/guide-poles.md`)** :
   - Responsabilités et livrables de chaque pôle :
     - Pôle Frontend / Mobile (`mobile-ionic`)
     - Pôle Backend / API REST (`apps/api`)
     - Pôle Base de Données (`database/` & PostGIS)
     - Pôle Workers & Temps Réel (`apps/workers`, `apps/ws`, RabbitMQ)
     - Pôle Réseau & Infrastructure (`infrastructure/`, Nginx, Docker)
   - Contrats de communication et règles de collaboration Git (branches, commits conventionnels).
4. **Guide de Build Android (`docs/build-android.md`)** :
   - Prérequis (Node, Capacitor, Android SDK, OpenJDK 21).
   - Configuration `org.gradle.java.home`.
   - Commandes de build web (`vite build`), synchronisation Capacitor (`cap sync android`), et compilation APK (`gradlew.bat assembleDebug`).
   - Déploiement et débogage via ADB.
5. **Référence API & Événements (`docs/api-reference.md`)** :
   - Endpoints REST Fastify : `/health`, `/api/players/me`, `/api/activities`, `/api/activities/me`.
   - Schémas Zod des requêtes et réponses JSON.
   - Format des messages du bus d'événements RabbitMQ (`activity.completed`).
6. **Documentation du Code (JSDoc)** :
   - Annotations JSDoc explicites sur les services critiques pour faciliter la maintenance : `useActiveWorkout`, `apiClient`, `AntiCheatService`, `ActivityService`.

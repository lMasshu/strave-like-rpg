# Directives Agents & Architecture - Stride Quest (strave-like-rpg)

Ce document sert de guide de référence pour tout agent autonome ou développeur intervenant sur le projet **Stride Quest**. Il synthétise la vision produit, l'état de l'existant technique, les règles d'architecture par pôle, ainsi que les standards d'ingénierie logicielle.

---

## 1. Vision Produit & Concept

**Stride Quest** est une application hybride fusionnant le **suivi d'activités sportives géolocalisées** (style Strava) et les **mécaniques de jeu vidéo de rôle et d'exploration** (RPG). L'objectif est d'encourager l'activité physique par la gamification et la coopération communautaire.

Le projet s'articule autour de trois piliers fondamentaux :

### A. Le Cœur "Tracking Sportif"
- **Système de comptes & profils** : Inscription, authentification sécurisée, niveau du joueur (XP), inventaire de badges, statistiques globales et historique d'activités.
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
├── mobile-ionic/           # Application mobile front-end (Ionic React)
│   ├── src/
│   │   ├── components/     # Composants UI (QuestGeneratorModal, QuestRunHud, GeolocationDebugConsole...)
│   │   ├── hooks/          # Hooks React (useGeolocationTracker, useQuestRun...)
│   │   ├── services/       # Services métier (geo, questGenerator, mapboxDirections, mapboxGeocoding...)
│   │   ├── pages/          # Écrans (Home, Map, Profile, FriendSearch, Notifications)
│   │   └── data/           # Types et données mockées/démo
│   └── vite.config.ts      # Configuration Vite & Vitest
├── apps/                   # Services backend (API, worker de télémétrie, cron de raids)
├── database/               # Schémas relationnels et extensions spatiales
│   └── init.sql            # Initialisation PostGIS, tables players, raids, activities, raid_damage_events
├── infrastructure/         # Définition des environnements de dev et production
│   └── docker-compose.yml  # Services conteneurisés PostgreSQL/PostGIS et Redis
├── packages/               # Contrats d'interfaces partagés (types DTO, contrats d'API)
└── .github/workflows/      # Intégration continue (ESLint, Prettier, Vitest, build Vite)
```

### Stack Technique en Place :
- **Mobile** : React 19, Ionic React 9, TypeScript 5.9, Vite 8, Mapbox GL 3.32, Capacitor 8 (Geolocation, Haptics, App, Status-bar).
- **Base de Données** : PostgreSQL 16 avec PostGIS 3.4 et extension `pgcrypto`.
- **Cache & Concurrence** : Redis 7 (Alpine).
- **Qualité & Tests** : ESLint 9, Prettier 3, Vitest 4, Cypress 13.

---

## 3. Directives d'Ingénierie par Pôle Technique

### 1. Pôle Développement (Dev) - Frontend & Logique Métier

#### Frontend / Mobile (`mobile-ionic/`) :
- **Précision Cartographique & GPS** :
  - Utiliser Mapbox GL pour le rendu vectoriel des cartes, des tracés actifs (`LineString`) et des POI.
  - S'appuyer sur le hook `useGeolocationTracker` pour la gestion des positions, de la précision (`accuracy`), du filtrage des sauts GPS anormaux et de la console debug.
  - Gérer rigoureusement les états de cycle de vie de l'application (mise en arrière-plan, reprise) via Capacitor.
- **Expérience Utilisateur & Game Design** :
  - Assurer des retours utilisateur immédiats (HUD de quête avec chrono, distance restante, barre de complétion).
  - Fournir des alertes haptiques (`@capacitor/haptics`) lors des jalons de quête ou validation d'objectifs.
  - Respecter la charte graphique sobre (vert nature athlétique, contraste accessible, mode sombre natif Ionic).
- **Icônes d'interface — collection Line MD obligatoire** :
  - Utiliser en priorité les icônes de [Material Line Icons](https://icon-sets.iconify.design/line-md/) (dépôt : [cyberalien/line-md](https://github.com/cyberalien/line-md), licence MIT) lorsqu'un équivalent pertinent existe.
  - Embarquer chaque SVG utilisé dans `mobile-ionic/public/icons/line-md/` et le déclarer dans l'union `LineMdIconName` de `mobile-ionic/src/components/LineMdIcon.tsx`. Ne jamais charger une icône depuis un CDN ou une URL distante à l'exécution.
  - Rendre les icônes via le composant `LineMdIcon`, avec `currentColor`, une taille héritée ou explicite et les slots Ionic préservés. Ne pas réintroduire `IonIcon` pour les icônes d'interface.
  - Marquer les icônes décoratives `aria-hidden`; toute action sans texte visible doit conserver un nom accessible (`aria-label`). Les animations restent discrètes et respectent `prefers-reduced-motion`.
  - Si Line MD ne propose pas d'équivalent, choisir le symbole sémantique le plus proche de la collection et documenter ce choix dans la revue ou la PR.

#### Backend & Logique Métier (`apps/`) :
- **Algorithme de Quêtes & POI** :
  - Empêcher tout positionnement de POI sur des zones dangereuses ou inaccessibles (autoroutes, cours d'eau profonds, propriétés privées) en exploitant les couches OSM / Mapbox Geocoding.
  - Générer des itinéraires cohérents avec estimation de durée réaliste selon l'allure cible.
- **Moteur d'Effort & Calcul de Dégâts de Raid** :
  - Transformer les métriques d'activité (vitesse moyenne, dénivelé positif, distance, régularité) en valeur de dégâts bruts.
  - Appliquer les multiplicateurs et résistances associés au type de boss.
- **Gestion des Raids** :
  - Orchestrer le cycle de vie des raids (planification, activation, gel à expiration, attribution des récompenses).

---

### 2. Pôle Base de Données (BD) - Données Spatiales & Concurrence

#### Modélisation Spatiale & PostGIS :
- Les tracés sont stockés sous forme géométrique projetée `GEOMETRY(LineString, 4326)`.
- Indexer systématiquement les colonnes géométriques avec des index GiST (`CREATE INDEX ... USING GIST (track);`).
- Privilégier les fonctions natives PostGIS pour les calculs de distance et de proximité :
  - `ST_DWithin(geog_point, geog_zone, radius_meters)` pour tester la présence du joueur dans le rayon d'un POI ou dans la zone d'influence d'un boss.
  - `ST_Length(geography(track))` pour calculer la distance exacte parcourue.
  - `ST_Distance` pour la recherche optimisée des tracés publics environnants.

#### Résolution de la Concurrence & Découpage Atomique :
- **Problème de Race Condition lors des Raids Mondiaux** :
  - Plusieurs milliers de sportifs peuvent soustraire des HP au même boss simultanément.
  - **Interdiction formelle** de faire un `SELECT current_health` suivi d'un `UPDATE` non verrouillé en application.
  - Utiliser des opérations atomiques directes côté base de données :
    ```sql
    UPDATE raids
    SET current_health = GREATEST(0, current_health - $1)
    WHERE id = $2 AND status = 'active'
    RETURNING current_health, status;
    ```
  - En cas de forte charge, déporter le décompte temps réel dans Redis (`DECRBY raid:<id>:hp <damage>`) et synchroniser la table PostgreSQL par batchs réguliers.

---

### 3. Pôle Réseau & Système (Infra) - Télémétrie, Anti-Triche & Scalabilité

#### Ingestion de Télémétrie & Flux GPS :
- Prévoir une ingestion asynchrone des coordonnées GPS pour éviter l'engorgement du serveur HTTP classique lors des sorties de groupe.
- Mettre en place un rate limiting équilibré (1 ping toutes les 3 à 5 secondes par joueur actif).

#### Sécurité & Anti-Triche (Anti-Spoofing GPS) :
- Les données envoyées par le client mobile **ne doivent jamais être considérées comme fiables par défaut**.
- Vérifications obligatoires côté serveur lors de la soumission d'une activité :
  - **Vitesse maximale plausible** : calcul de vélocité entre deux points successifs (`distance / delta_t`). Tout trajet pédestre dépassant 35 km/h ou cycliste dépassant 90 km/h doit être flaggé.
  - **Cohérence d'accélération** : détection des téléportations instantanées (spoofer de position GPS).
  - **Consistance de l'effort** : recoupement entre la distance calculée via les coordonnées brutes et la durée réelle de l'enregistrement.
  - Refus d'application des dégâts de raid si l'activité échoue aux tests de légitimité.

#### Caching & Performance (Redis) :
- Mettre en cache les données hautement sollicitées en lecture : fiche signalétique des Boss actifs, liste des tracés publics populaires d'un secteur, états de sessions.
- Éviter toute surcharge inutile de la base PostGIS pour les lectures répétées.

#### CI/CD & Déploiement :
- Tout code doit être testable en environnement conteneurisé.
- La CI GitHub Actions (`.github/workflows/ci.yml`) est la référence absolue de non-régression.

---

## 4. Standards de Développement & Conventions pour les Agents

Toute contribution de code par un agent doit scrupuleusement respecter les règles suivantes :

1. **TypeScript Strict** :
   - Typage explicite des paramètres, retours de fonctions et structures de données.
   - Aucun `any` implicite. Modéliser les interfaces dans `src/data/` ou dans un package partagé.

2. **Tests Automatisés Systématiques** :
   - Tout nouveau service, hook complexe ou calcul géométrique **doit** s'accompagner d'un fichier de test unitaire Vitest (`*.test.ts` ou `*.test.tsx`).
   - S'assurer que la couverture des cas limites (absence de signal GPS, coordonnées invalides, temps imparti écoulé) est testée.

3. **Style & Formatage du Code** :
   - Formater avec Prettier avant chaque validation (`npm --prefix mobile-ionic run format`).
   - Corriger tout avertissement ESLint (`npm --prefix mobile-ionic run lint`).

4. **Conventions de Commit (Conventional Commits en Français)** :
   - Format : `<type>(<scope>): <description concise en minuscules>`
   - Types valides : `feat`, `fix`, `style`, `refactor`, `test`, `docs`, `chore`, `perf`.
   - Scopes habituels : `gps`, `carte`, `generator`, `poi`, `ui`, `theme`, `lint`, `raid`, `db`, `infra`.
   - Exemple : `feat(raid): calcul atomique des degats et gestion de l'expiration`.

5. **Sécurité & Variables d'Environnement** :
   - Ne jamais commiter de secrets, tokens Mapbox ou identifiants de base de données dans le code source.
   - Utiliser les fichiers d'environnement (`.env`) prévus à cet effet.

---

## 5. Commandes Essentielles

| Action | Commande |
| :--- | :--- |
| **Démarrage Dev Mobile** | `npm run dev` *(ou `npm --prefix mobile-ionic run dev`)* |
| **Lancement Vitest (Unique)** | `npm run test` *(ou `npm --prefix mobile-ionic run test.unit -- --run`)* |
| **Linter ESLint** | `npm run lint` *(ou `npm --prefix mobile-ionic run lint`)* |
| **Vérification Format Prettier** | `npm --prefix mobile-ionic run format:check` |
| **Application Format Prettier** | `npm --prefix mobile-ionic run format` |
| **Compilation TypeScript & Vite** | `npm run build` *(ou `npm --prefix mobile-ionic run build`)* |
| **Démarrage Infrastructure (Docker)** | `docker compose -f infrastructure/docker-compose.yml up -d` |
| **Vérification Workflow Complet** | Utiliser le skill `@commit-push` |

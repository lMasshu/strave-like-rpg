# Stride Quest

Application mobile de suivi d'activites sportives geolocalisees avec une boucle de jeu de type RPG.

## Demarrage rapide

Prerequis : Node.js 20 ou plus recent.

```bash
npm install --prefix mobile-ionic
npm run dev
```

Le dashboard est disponible sur l'URL affichee par Vite. Pour verifier la compilation :

```bash
npm run build
```

Pour lancer les services de developpement PostgreSQL/PostGIS et Redis :

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

Les identifiants locaux sont `stride` / `stride_dev` pour la base `stride_quest`. Ils sont reserves au developpement.

## Organisation

- `mobile-ionic/` : application Ionic React et futures integrations GPS/cartographiques.
- `apps/` : services applicatifs a venir (API et logique metier).
- `database/` : schema PostgreSQL/PostGIS et donnees de developpement.
- `infrastructure/` : services Docker locaux PostgreSQL/PostGIS et Redis.
- `packages/` : contrats partages entre les applications.

Le dashboard utilise actuellement des donnees de demonstration. La capture GPS, la validation anti-triche et l'application des degats de raid seront raccordees au service backend. Les mises a jour de points de vie devront utiliser une transaction SQL ou une operation Redis atomique cote serveur.
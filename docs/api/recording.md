# Journal sportif version 1

`POST /api/activities` accepte un champ facultatif `recording`. Le même contenu est conservé dans `GET /api/activities/:id` et l'historique `GET /api/activities/me`. L'[exemple JSON de référence](./recording.example.json) est vérifié par les tests du constructeur mobile et du round-trip API.

## Unités et types

| Champ                      | Type / unité                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `version`                  | `1`                                                                                             |
| `requestedIntervalMs`      | `1000` : cadence demandée, pas garantie                                                         |
| `samples[].timestampMs`    | entier positif, Unix UTC en millisecondes, heure de mesure réelle                               |
| `latitude`, `longitude`    | degrés WGS84 ; lat [-90,90], lon [-180,180]                                                     |
| `altitudeMeters`           | nombre fini en mètres ou `null` ; altitude négative permise                                     |
| `horizontalAccuracyMeters` | nombre fini ≥ 0 en mètres ou `null`                                                             |
| `speedMetersPerSecond`     | nombre fini ≥ 0 en m/s ou `null`                                                                |
| `speedSource`              | `native`, `derived` ou `null` ; si vitesse inconnue, source nulle                               |
| `source`                   | `gps` ou `simulation` ; ne pas confondre une simulation avec une course réelle                  |
| `events[]`                 | `type`: start/pause/resume/finish, `timestampMs`                                                |
| `segments[]`               | `reason`: start/resume/gps-gap/source-change ; `sampleIndices`: indices croissants dans samples |
| `elapsedDurationMs`        | durée murale start→finish, pauses incluses                                                      |
| `activeDurationMs`         | somme des périodes start/resume→pause/finish                                                    |

Les heures de l'enveloppe `startedAt`/`endedAt` restent des ISO UTC. `durationSeconds` reste la **durée active**, égale à `activeDurationMs / 1000` (fractions conservées, tolérance de comparaison serveur 1 ms). La distance envoyée vient des mètres internes, pas des kilomètres d'affichage arrondis.

## Mesures, tracé et temps

- Un fix n'est jamais ajouté pour combler un trou ni pour régulariser le pas. Les fixes réellement reçus plus fréquemment qu'une seconde sont conservés.
- Chaque mesure structurellement valide pendant l'enregistrement est gardée, y compris l'immobilité et la précision insuffisante. Les valeurs absentes restent null, jamais des zéros fictifs.
- Les timestamps sont strictement croissants. Coordonnées invalides, timestamp absent, futur, dupliqué ou antérieur à la reprise sont rejetés à la capture. Les erreurs de chronologie des actions restent explicites.
- Les événements ont un ordre non décroissant ; start est unique, pause/resume alternent, finish est terminal. Un fix capturé dans la même milliseconde que pause/finish peut précéder cette action ; un fix à l'instant exact de start/resume n'est pas retenu.
- Les points de tracé doivent avoir une précision connue ≤ 25 m. Les filtres sportifs de distance/vitesse continuent à s'appliquer séparément. La moyenne sportive n'est jamais substituée à une mesure instantanée manquante.
- Après pause/reprise, erreur GPS, changement de source ou > 5 000 ms sans fix exploitable, le tracé ouvre un segment. Un fix précis immobile renouvelle la continuité même s'il n'est pas ajouté à la polyline. Les sauts géométriques rejetés interrompent aussi le segment.
- Ni distance, ni dénivelé, ni ligne de carte ne relient deux segments. La carte utilise un MultiLineString ; un segment d'un seul point reste stocké mais n'est pas dessiné comme une ligne.
- Les `coordinates` historiques sont l'aplatissement des points référencés par les segments, pour les anciens consommateurs. Elles ne suffisent pas à reconstruire les pauses : utiliser `recording.segments` pour les futurs exports.

## Sauvegarde et limites

Start, pause, reprise et finish sont enregistrés au moment de l'action. Terminer fige les heures, même si la sauvegarde arrive trente secondes après. En cas d'échec réseau, la course reste **en mémoire dans le mobile** et peut être réessayée via Terminer → Enregistrer l'activité. Aucun message ne prétend la sauvegarder sur disque.

Le serveur valide forme, valeurs, ordre des événements/mesures, durées, indices, qualité du tracé, absence de raccord entre fenêtres actives et projection des coordonnées **avant** attribution d'XP. Limites : 100 000 mesures, 10 000 événements, 10 000 segments, 100 000 indices au total et corps HTTP 32 MiB sur cette route. Dépassement : rejet explicite (400 ou 413), jamais troncature.

Une activité sans recording reste compatible. Aucune heure de point n'est reconstruite pour les anciennes activités.

## Ce qui n'est pas garanti

- Le repository API est toujours **InMemory** : toutes les activités disparaissent au redémarrage du service. Le mobile n'a pas de sauvegarde durable/offline non plus.
- Une réponse perdue après traitement serveur peut entraîner un doublon lors d'une nouvelle tentative : pas encore d'idempotence.
- La validation du contrat et l'anti-triche historique ne prouvent ni l'authenticité GPS ni l'effort physique. Authentification, droits d'accès et durcissement général API restent un chantier distinct ; ne pas exposer cette API non protégée à des utilisateurs non fiables.
- Pas d'intégration Strava, pas d'export GPX, pas de migration SQL et pas de moteur natif de suivi en arrière-plan dans cette étape. Cadence et comportement téléphone/verrouillage restent à tester sur appareil.

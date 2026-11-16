# Base d'enregistrement sportif horodaté

## Accord et objectif

L'utilisateur valide une base propre avant tout export Strava et demande de rester sur `fix/gps-live-pace`, dans le worktree courant. Réutiliser l'exécution native choisie pour le chantier précédent. Cette étape prépare des données exportables sans implémenter GPX ni OAuth.

Approches discutées : ajouter seulement les heures aux anciennes coordonnées (insuffisant pour pauses et qualité), conserver mesures/chronologie/tracé séparément (retenu), intégration Strava immédiate (hors périmètre).

## État actuel et conséquences

- Le tracker reçoit un timestamp par mesure mais le hook ne conserve que les coordonnées filtrées par distance.
- Le chrono compte les callbacks d'un intervalle ; le début est reconstruit au moment de sauvegarder.
- La pause et les coupures ne réinitialisent pas toutes les références géométriques : risque de raccord entre deux périodes discontinues.
- L'API ne connaît pas les points horodatés ; son repository reste en mémoire.
- Le mobile annonce une sauvegarde locale après échec réseau puis réinitialise la course alors qu'aucune persistance locale n'existe. Le nouveau flux doit garder la course en mémoire en cas d'échec et afficher l'erreur honnêtement.

## Contrat de données

Conventions communes : nombres finis, degrés WGS84, mètres, m/s, timestamps Unix UTC en millisecondes entières positives. Aucun arrondi à la capture ; `null` signifie inconnu et zéro reste une mesure réelle. `startedAt`/`endedAt` HTTP restent des chaînes ISO UTC pour compatibilité.

`RecordedSample` : `latitude`, `longitude`, `timestampMs`, `altitudeMeters: number | null`, `horizontalAccuracyMeters: number | null`, `speedMetersPerSecond: number | null`, `speedSource: "native" | "derived" | null`, `source: "gps" | "simulation"`.

`RecordingEvent` : `type: "start" | "pause" | "resume" | "finish"`, `timestampMs`.

`TrackSegment` : `sampleIndices: number[]` (références aux mesures retenues pour la carte/distance), `reason: "start" | "resume" | "gps-gap" | "source-change"`.

`ActivityRecording` : `version: 1`, `requestedIntervalMs: 1000`, `samples: RecordedSample[]`, `events: RecordingEvent[]`, `segments: TrackSegment[]`, `elapsedDurationMs`, `activeDurationMs`.

Le champ HTTP facultatif `recording` transporte cet objet. Les anciennes activités sans ce champ restent lisibles et ne reçoivent jamais d'horodatages inventés. Les `coordinates` existantes restent un dérivé aplati de compatibilité, pas une représentation apte à reconstruire les interruptions.

Le contrat HTTP est décrit dans `docs/api/recording.md`. Des types DTO équivalents restent dans les modules mobile et domaine API existants ; pas de nouveau package/workspace ni modification du rootDir TypeScript pour cette étape. Des fixtures de round-trip vérifient leur compatibilité.

## Capture et validation

- Demander un fix toutes les 1 000 ms comme aujourd'hui ; conserver chaque mesure valide réellement reçue pendant recording, sans rééchantillonnage ni interpolation. Un pas reçu plus court est accepté : la fréquence demandée n'est pas une promesse.
- Rejeter coordonnées hors bornes/non finies, timestamps invalides/futurs et timestamps non strictement croissants. Ne pas remplacer un timestamp absent par Date.now(). Les anciens fixes avant début/reprise ne sont pas enregistrés.
- Les mesures à l'arrêt, sans vitesse ou avec précision inconnue/faible sont conservées si coordonnées et timestamp sont valides. Elles ne doivent pas artificiellement augmenter la distance.
- Précision absente/invalide devient `null`, pas zéro. Vitesse négative/non finie et altitude non finie deviennent `null`. L'origine native/calculée est conservée. Adapter les consommateurs de `TrackedPosition.accuracy` au nullable, notamment allure et validation de quête : une précision inconnue n'est pas une précision parfaite.
- Le filtre sportif conserve ses seuils (précision maximale 25 m, déplacement minimal max(2 m, précision × 0,4), vitesse géométrique maximale 12 m/s). Les vitesses/altitudes inconnues ne sont pas fabriquées ; le fallback vitesse ne déduit pas de vitesse de part et d'autre d'une coupure.

## Temps et interruptions

- Start/resume/pause/finish sont horodatés lors de l'action, pas lors de la sauvegarde. Les transitions invalides ou répétées n'ajoutent pas d'événement.
- Les durées sont calculées depuis les intervalles entre événements, pas depuis le nombre de ticks. `activeDurationMs` exclut les pauses ; `elapsedDurationMs` les inclut. Finish fige les heures et les durées, y compris si la sauvegarde arrive plus tard.
- Pas de mesure enregistrée pendant pause ; la reprise exige un nouveau fix. Terminer pendant pause ferme correctement la chronologie.
- Ouvrir un nouveau segment à la reprise, au changement réel/simulation, après une erreur GPS ou plus de 5 000 ms entre mesures exploitables pour le tracé. Le seuil de coupure proposé par l'agent est distinct des 3 000 ms de fraîcheur de l'allure.
- Pour ces 5 000 ms, chaque fix ordonné avec précision connue ≤ 25 m renouvelle la continuité, même immobile ou sous le seuil de déplacement. Ne pas utiliser la date du dernier point ajouté à la polyline : cela couperait à tort la marche lente. Un saut rejeté par le filtre de vitesse casse la continuité ; le prochain fix exploitable devient une nouvelle origine.
- Ne pas calculer distance/dénivelé entre segments. Ne pas dessiner leur raccord : la source Mapbox du tracé enregistré devient un MultiLineString (omettre les segments avec moins de deux points pour le rendu seulement).
- Le tableau de mesures est indépendant des indices filtrés : un point immobile ne disparaît pas du journal. Les échantillons simulés sont marqués ; ne jamais les présenter comme des mesures physiques.

## Sauvegarde et compatibilité

- Envoyer les heures figées et `recording` via apiClient. Distance en mètres depuis la valeur interne non arrondie, pas reconvertie depuis `distanceKm` arrondi ; affichage seul arrondi.
- `durationSeconds` garde le sens durée active en secondes, dérivée de `activeDurationMs / 1000`, sans forcer une seconde fictive.
- Adapter schéma Zod, mapping de route, entités et copie repository ; conserver le contenu dans POST → GET détail et historique sans perte ni alias mutable.
- Valider côté serveur bornes, champs nullables, ordre temporel, événements légaux, durées cohérentes, indices/ordre des segments, correspondance des dates/coordonnées/durée avec l'enveloppe historique. Un segment ne référence que des points aptes au tracé et chaque indice est utilisé au plus une fois.
- Limites de sécurité proposées : 100 000 mesures, 10 000 événements, 10 000 segments, 100 000 indices au total ; corps de POST activité limité à 32 MiB. Rejet explicite, jamais troncature silencieuse ; aucune garantie d'enregistrement illimité.
- Conserver `recording` facultatif : l'anti-triche existant reste en place, sans prétendre que ces validations constituent un anti-spoofing complet. Pas de modification Auth0/CORS/identité ni de moteur XP/raids.
- En cas d'échec sauvegarde, conserver le snapshot en mémoire et permettre une nouvelle tentative. Cela ne garantit pas la persistance après fermeture, ni l'idempotence après réponse réseau perdue.

## Précisions de conception après relecture

- Événements ordonnés de façon non décroissante (deux actions peuvent partager une milliseconde), mesures strictement croissantes ; bornes des mesures incluses entre start et finish, avec exclusion des périodes de pause. Un retour en arrière de l'horloge UTC rend la transition invalide et doit produire une erreur explicite, sans durée négative.
- Les métadonnées du tracker restent indépendantes de la session. À la première mesure d'un segment, une vitesse dérivée à partir d'une autre période ne doit pas être réutilisée : conserver une vitesse native ou `null` jusqu'au prochain calcul valide.
- Les coordonnées historiques correspondent à l'aplatissement des indices de segments ; la durée historique est exactement `activeDurationMs / 1000`, avec tolérance numérique serveur de 1 ms pour les comparaisons de durée.

## Hors périmètre et validation

Pas de migration BDD (travail du coéquipier), stockage disque/offline, worker d'arrière-plan natif, Strava, GPX, changement de cadence native, nouvelle dépendance ni amélioration générale de sécurité API. Le repository mémoire ne survit pas au redémarrage. Les filtres restent une heuristique de qualité, pas une preuve d'effort.

Tests : formats et sources, cadence irrégulière, doublons/hors ordre, immobilité, faible précision, absence GPS, pause/reprise/fin et temps de sauvegarde différé, coupures et changements de source, React StrictMode, sérialisation/réception API et compatibilité historique. Build/typecheck mobile ET API. Validation réelle Android/navigateur nécessaire pour la cadence et l'arrière-plan.

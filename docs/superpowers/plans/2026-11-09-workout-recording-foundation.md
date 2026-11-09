# Workout Recording Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conserver des courses horodatées, segmentées et transmissibles sans perte à l'API, avant tout export sportif.

**Architecture:** Un service pur gère la chronologie, les mesures et les segments. Le tracker fournit des valeurs typées et leur provenance ; le hook ne conserve plus de logique d'accumulation imbriquée dans des setters React. Un constructeur de payload fige la sauvegarde ; le domaine API et son repository mémoire conservent le contrat validé.

**Tech Stack:** TypeScript strict, React/Ionic/Capacitor existants, Fastify/Zod, Vitest/Testing Library. Aucune nouvelle dépendance.

**Spec:** `docs/superpowers/specs/2026-11-09-workout-recording-foundation-design.md`

## Global Constraints

- Rester sur `fix/gps-live-pace` et dans le worktree actuel ; ne pas créer d'autre branche/worktree.
- Cadence demandée 1 000 ms ; pas d'interpolation ni d'horodatage inventé ; conserver chaque fix structurellement valide en recording.
- Coupure après plus de 5 000 ms entre fixes aptes au tracé, y compris ceux sous le seuil de déplacement ; indépendamment des 3 000 ms de fraîcheur de l'allure.
- Filtres sportifs existants : précision ≤ 25 m, déplacement minimal max(2 m, précision × 0,4), plafond géométrique 12 m/s. Pas de distance/dénivelé entre segments.
- Données inconnues nullables ; timestamps UTC ms entiers positifs ; coordonnées WGS84 ; mesures sans arrondi à la capture.
- Contrat `recording` version 1 facultatif pour compatibilité ; pas de migration BDD, Strava/GPX, stockage disque, authentification ni nouvel anti-spoofing.
- Limites POST : 100 000 mesures, 10 000 événements, 10 000 segments, 100 000 indices au total, bodyLimit route activité 32 MiB. Jamais tronquer les données.
- Aucun nouveau commit/push sans autorisation explicite pour ce chantier ; la PR #13 existe déjà sur cette branche.

## Review Focus

- StrictMode et callbacks répétés : pas de double mesure/distance/événement.
- Marche lente ou immobilité > 5 s avec fixes précis : ne pas déclarer une coupure artificielle.
- Pause, perte GPS ou changement simulation/réel : pas de raccord géométrique ni de vitesse dérivée entre périodes.
- Sauvegarde tardive ou en erreur : conserver les heures de course et le snapshot ; ne pas annoncer une sauvegarde locale inexistante.
- Anciennes activités sans recording : lecture/écriture compatibles sans inventer un journal ; repository sans alias mutables sur les tableaux imbriqués.

---

### Task 1: Mesures typées et provenance du tracker

**Files:** créer `mobile-ionic/src/data/activityRecording.ts` ; modifier `hooks/useGeolocationTracker.ts`, `.test.ts`, `services/livePace.ts`, `.test.ts`, `services/questProgress.ts`, `.test.ts`, `hooks/useQuestRun.ts`, `components/GeolocationDebugConsole.tsx` et `pages/Map.tsx` pour le nullable. Tests existants de console/quête selon usages.

**Interfaces:** types `RecordedSample`, `RecordingEvent`, `TrackSegment`, `ActivityRecording` exactement selon la spec. `TrackedPosition.accuracy: number | null` ; ajouter `speedSource: "native" | "derived" | null` (facultatif dans l'interface du tracker pour compatibilité des anciens consommateurs ; production le renseigne toujours). Le champ homologue du sample est obligatoire et vaut null si provenance inconnue. Le type du fix de quête accepte également accuracy nullable.

- [ ] Ajouter les tests tracker : native 3,125 m/s conserve sa valeur et sa provenance ; fallback valide marque derived ; altitude/vitesse/précision inconnue restent null ; précision zéro reste zéro ; timestamp absent/non fini/futur, coordonnées invalides, fix dupliqué ou hors ordre ne remplacent pas le dernier fix ; erreur GPS ou intervalle > 5 000 ms réinitialisent l'origine du fallback. Tester que quête/allure ne valident pas une précision inconnue.
- [ ] Lancer les tests ciblés tracker, livePace et questProgress ; observer les échecs correspondant aux attentes ajoutées.
- [ ] Implémenter la normalisation et les types, sans changer la demande 1 000 ms. Ne pas fabriquer un timestamp de remplacement. Adapter les consommateurs à null et leurs messages ; ne pas changer leur comportement pour un fix de précision connue.
- [ ] Relancer ces tests et typecheck mobile (`mobile-ionic/node_modules/.bin/tsc -p mobile-ionic/tsconfig.json --noEmit`) ; résultat attendu zéro échec/erreur.

### Task 2: Journal, chronologie et segments purs

**Files:** créer `mobile-ionic/src/services/workoutRecording.ts` et `workoutRecording.test.ts`.

**Interfaces:** exporter `WorkoutRecordingState`, `RecordingSnapshot`, `RecordingAction`, `createRecordingState(): WorkoutRecordingState`, `reduceRecording(state: WorkoutRecordingState, action: RecordingAction): WorkoutRecordingState`, `getRecordingSnapshot(state: WorkoutRecordingState, nowMs: number): RecordingSnapshot | null`. Snapshot : `startedAtMs: number`, `endedAtMs: number | null`, `recording: ActivityRecording`, `distanceMeters: number`, `elevationGainMeters: number`. Actions : start/pause/resume/finish avec `timestampMs`, sample avec `sample: RecordedSample` et `receivedAtMs`, signalLost sans date, reset sans date. Les erreurs de transition temporelle sont explicites (`Error`) et n'altèrent jamais l'état fourni ; les transitions répétées/illégales de statut sont des no-op.

- [ ] Tests avec valeurs littérales : start=100000, pause=105250, resume=108000, finish=112500 → elapsed=12500 ms et active=9750 ms, snapshot identique à now=200000. Fin pendant pause, actions répétées, clock rollback, reset et sessions sans fix.
- [ ] Tests de points : arrêt avec un fix précis toutes les secondes pendant 10 s conserve 10 mesures sans distance ; doublon/hors ordre rejeté ; faible précision/null stockés mais hors tracé ; marche lente avec déplacements sous seuil ne coupe pas ; coupure 5001 ms ou signalLost/reprise/changement de source ouvre un segment sans distance/dénivelé de raccord ; frontière 5000 ms ne coupe pas ; mesure en pause/hors limites temporelles exclue ; vitesse derived au début d'un segment devient null, native reste conservée.
- [ ] Lancer `npm --prefix mobile-ionic run test.unit -- --run src/services/workoutRecording.test.ts` et constater le rouge.
- [ ] Implémenter le reducer sans mutation d'entrées ni setters imbriqués. Réutiliser Haversine et les filtres de la spec. Les références internes de continuité sont distinctes du dernier point retenu ; calculer les durées depuis événements, pas les ticks. Conserver la pleine précision des mètres en interne ; les règles de dénivelé existantes restent inchangées hors coupures.
- [ ] Relancer le même fichier ; tous les cas passent. Ajouter assertion d'immutabilité de l'état et des snapshots.

### Task 3: Intégration mobile et sauvegarde fidèle

**Files:** modifier `hooks/useActiveWorkout.ts`, `.test.ts`, `services/apiClient.ts`, `.test.ts`, `pages/Map.tsx` ; créer `services/activityPayload.ts`, `.test.ts` ; adapter les fixtures de métriques/consommateurs. Ajouter un test de flux de sauvegarde dans `pages/Map.test.tsx` (mock des frontières Mapbox/API uniquement).

**Interfaces:** le hook expose `recordingSnapshot: RecordingSnapshot | null`, `trackSegments: [number, number][][]`, garde `trackCoordinates` aplati pour les usages compatibles. `elapsedSeconds` garde son sens de durée active affichée, dérivée de `activeDurationMs`, pas le sens de durée murale. `SaveActivityDto.recording?: ActivityRecording`. Exporter `createActivityPayload(snapshot: RecordingSnapshot, activityType: SaveActivityDto["activityType"]): SaveActivityDto` ; refuser un snapshot non terminé. La valeur distance payload vient des mètres non arrondis du snapshot ; les anciennes métriques arrondies restent pour l'affichage.

- [ ] Ajouter les tests hook : capture arrêt/qualité sans perte dans samples, StrictMode sans double accumulation, pause/reprise et fin différée, chrono après un saut de temps sans callback par seconde, simulation marquée et handoff sans raccord, reset complet. Adapter les vieux timestamps des fixtures à l'horloge de test.
- [ ] Ajouter tests payload/client : sérialisation exacte du contrat, 12,345 mètres restent 12,345 ; durées et heures figées malgré sauvegarde 30 s plus tard ; aucun timestamp synthétisé pour les points ; erreur si session inachevée.
- [ ] Lancer ces tests et observer les échecs. Intégrer le reducer dans le hook pour mesures réelles/simulées, actions et chrono. Garder l'allure instantanée de la PR #13 et sa fraîcheur indépendantes. Ne plus effectuer d'effets secondaires dans les updaters d'état.
- [ ] Adapter Map : MultiLineString construit depuis `trackSegments` (sans lignes de moins de deux points), constructeur de payload pour save, reset seulement après succès confirmé. En erreur : toast explicite sans mention de stockage local et snapshot conservé. Tester échec puis nouvelle tentative ; jamais d'envoi automatique ni de simulation présentée comme réelle.
- [ ] Relancer tests hook, payload, client et Map ; zéro échec. Vérifier que la carte reste une projection du journal, pas sa source de vérité.

### Task 4: Réception API, conservation et documentation

**Files:** créer `apps/api/src/core/entities/activityRecording.ts`, `core/services/recordingValidation.ts`, `.test.ts`, `infrastructure/http/recordingSchema.ts` ; modifier `core/entities/activity.ts`, `core/services/activityService.ts`, `.test.ts`, `infrastructure/http/app.ts`, `.test.ts`, `infrastructure/repositories/inMemory/inMemoryActivityRepo.ts` ; ajouter `inMemoryActivityRepo.test.ts` et `docs/api/recording.md`.

**Interfaces:** les types recording reprennent la spec et le contrat mobile sans import runtime inter-app. `Activity.recording?: ActivityRecording` et `CreateActivityInput.recording?: ActivityRecording`. `validateRecording(input: CreateActivityInput): { isValid: boolean; reason?: string }` appelé AVANT toute attribution XP ou persistance. Le schéma Zod garde recording facultatif, mais valide strictement sa forme et ses limites ; la route applique le bodyLimit 32 MiB. Le service reporte recording sans en perdre les champs. Le repository clone profondément les structures à l'écriture ET à la lecture.

- [ ] Tests RED API : fixture mobile version 1 POST→GET détail/historique conserve samples, null, sources, pauses, segments et durées ; ancien payload sans recording reste accepté. Corps mal formé, limites dépassées, coordonnées hors bornes, temps hors session/en pause/hors ordre, événements illégaux, durées incohérentes et indices invalides/dupliqués/hors ordre → 400 sans modification du profil. Comparaison enveloppe dates/coordinates/durée active avec tolérance de 1 ms.
- [ ] Tests RED repository : modifier les tableaux imbriqués de l'entrée ou de deux lectures successives ne modifie pas l'activité conservée. Tests unitaires des bornes 100000/100001 mesures, 10000/10001 événements/segments, indices totaux et taille HTTP sans créer une requête réseau réelle.
- [ ] Implémenter schéma, validation temporelle/indexée, mapping, stockage et clone. Ne pas remplacer l'anti-triche existant ni prétendre certifier l'effort réel. Mettre les erreurs recording dans le chemin 400 existant avant effets de bord.
- [ ] Relancer tests API (`npm --prefix apps/api test`) et build (`npm --prefix apps/api run build`) : zéro échec. Documenter les unités/types, cadence demandée vs reçue, journal vs tracé, pauses et limites ; noter legacy sans heures, stockage mémoire, absence offline/idempotence et non-intégration Strava.
- [ ] Formatage ciblé, lint mobile, format:check mobile, `npm test`, builds mobile et API, `git diff --check`. Consigner les avertissements préexistants sans élargir le correctif.
- [ ] Revue indépendante de tout le diff depuis 170ba87, avec focus sur les cinq risques ci-dessus ; traiter les constats importants par tests rouge→vert. Présenter les résultats et les limites terrain, sans commit/push automatique.

## État et décisions

- [x] Périmètre validé ; branche actuelle imposée par l'utilisateur.
- [x] Conception relue par un builder indépendant : préciser la continuité GPS pour la marche lente. Décision consignée dans la spec.
- [x] Plan relu : interfaces et couverture des cinq risques vérifiées.
- [x] Relecture/approbation des paramètres détaillés avant implémentation native.
- [x] Tâches 1–4 et validation automatisée.
- [ ] Validation terrain Android/navigateur, notamment arrière-plan et cadence réelle.

## Résultats et décisions d'exécution

- 263 tests réussis : 218 mobile et 45 API. Lint, contrôle Prettier global mobile, builds mobile/API et `git diff --check` vérifiés. Le build mobile conserve ses avertissements préexistants Ionic, taille des bundles et temps des plugins.
- Ajout de listeners synchrones facultatifs au tracker : les callbacks peuvent être regroupés par React et ne doivent pas faire perdre de mesures ni de signal de coupure. Test intégré des vrais hooks avec callbacks batchés.
- Le pas de simulation libre devient cohérent avec sa vitesse déclarée (3 m à 3 m/s) : l'ancien pas dépassait le filtre géométrique de 12 m/s. Les mesures restent explicitement marquées simulation.
- Le calcul des durées est séparé de la copie du journal pour ne pas cloner toute la course toutes les 250 ms.
- Revue indépendante : trois problèmes importants détectés puis reproduits/corrigés par tests rouge→vert (vitesse dérivée traversant une pause, réponse initiale GPS plus récente ignorée, sauvegarde tardive d'une ancienne course effaçant la nouvelle).
- Le dénivelé perdu en présence d'une altitude inconnue a été reclassé important et corrigé : baseline par segment, sans remplir les altitudes nulles. Aucun constat de revue différé.
- Le reset de l'historique de vitesse conserve une borne temporelle : un résultat GPS retardé datant d'avant la reprise ne réinjecte pas l'ancien lissage.
- La sauvegarde est associée à une génération de session locale au hook ; une réponse tardive ne réinitialise que la session correspondante.
- Les sept tests Map existants sont conservés, avec les nouveaux scénarios d'erreur/réessai et de réponse tardive.
- Revue du diff non committé depuis `170ba87` ; worktree conservé. Après les validations finales, l'utilisateur a autorisé le commit, le push et la mise à jour de la PR #13 vers develop, sans fusion.

## Limites maintenues

Pas de stockage durable, idempotence, SQL, Strava/GPX ou intégration d'authentification. La validation de contrat ne rend pas l'API sûre à exposer publiquement. Cadence matérielle, consommation et suivi en arrière-plan nécessitent un test sur appareil ; aucun résultat matériel n'est revendiqué.

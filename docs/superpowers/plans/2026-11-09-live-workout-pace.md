# Live Workout Pace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher une allure réellement instantanée sans confondre arrêt, moyenne et perte de signal.

**Architecture:** Un service pur décide du statut et du texte depuis le fix, son âge et l'état sportif. Le hook fournit une horloge de fraîcheur et les métriques ; Map présente ces états sans changer le suivi de distance.

**Tech Stack:** React, TypeScript strict, Vitest, Testing Library, Capacitor Geolocation existant.

**Spec:** `docs/superpowers/specs/2026-11-09-live-workout-pace-design.md`

## Global Constraints

- Conserver la demande GPS à 1 000 ms, le lissage et les seuils du tracker existant.
- Expiration à 3 000 ms ; horloge de fraîcheur à 250 ms uniquement pendant l'enregistrement.
- Précision acceptable : 25 m maximum. Timestamp invalide/futur ou vitesse négative/non finie : indisponible.
- Aucune dépendance nouvelle, aucun changement distance/XP, API, Auth0 ou Vite.
- Ne pas committer/pousser sans autorisation pour ce chantier ; branche GPS distincte lors de l'exécution, après inspection Git.

## Review Focus

- Marche lente : une vitesse positive sous 0,5 m/s reste une allure, pas un arrêt.
- Arrondi des secondes : aucun affichage `5:60`.
- Silence GPS : expiration même sans nouvelle position React.
- Reprise : le fix pré-pause ne devient pas une mesure fraîche par simple reprise.
- Simulation : rester fonctionnelle sans faire passer un fix réel périmé pour valide.

---

### Task 1: Décision et formatage purs

**Files:** créer `mobile-ionic/src/services/livePace.ts` et `livePace.test.ts`.

**Interfaces:** exporter `LivePaceState = "moving" | "stopped" | "unavailable" | "paused" | "inactive"`, `LivePaceResult { state: LivePaceState; paceMinPerKm: string }` et `getLivePace(position: TrackedPosition | null, nowMs: number, status: WorkoutStatus): LivePaceResult`. Imports de types seulement pour éviter un cycle runtime.

- [ ] Écrire les tests : 3 m/s → `5:33` ; 0 → stopped/`--:--` ; 0,4 → moving/`41:40` ; vitesse `1000 / 359.6` → `6:00` ; null, NaN, négative, précision 26 m, date future/invalide → unavailable ; âge 2 999 ms valide et 3 000 ms indisponible ; pause → paused ; idle/finished → inactive.
- [ ] Lancer `npm --prefix mobile-ionic run test.unit -- --run src/services/livePace.test.ts` ; constater l'échec dû au service manquant.
- [ ] Implémenter le service selon la spec ; arrondir les secondes totales avant division minutes/secondes. Pas de calcul de moyenne.
- [ ] Relancer la même commande ; tous les cas passent.

### Task 2: Intégration au hook et expiration

**Files:** modifier `mobile-ionic/src/hooks/useActiveWorkout.ts` et `useActiveWorkout.test.ts`.

**Interfaces:** consommer `getLivePace` ; ajouter `paceState: LivePaceState` à `ActiveWorkoutMetrics`, conserver `paceMinPerKm: string` pour les consommateurs existants. `speedKmh` reste inchangé ; seul l'affichage de l'allure relève de cette intervention.

- [ ] Ajouter des tests avec horloge simulée : après une distance > 50 m, vitesse zéro → `--:--` sans fallback ; fix périmé après avance de l'horloge sans rerender manuel → unavailable ; réception d'un nouveau fix → moving ; pause et fin ne montrent pas d'allure active ; reprise exige un timestamp postérieur à la reprise ; simulation conserve une allure valide après plusieurs ticks. Utiliser des timestamps cohérents avec `vi.setSystemTime` pour les fixtures existantes.
- [ ] Lancer `npm --prefix mobile-ionic run test.unit -- --run src/hooks/useActiveWorkout.test.ts` et vérifier les échecs attendus.
- [ ] Remplacer `formatPace` par le service, ajouter l'horloge à 250 ms et son nettoyage. Mémoriser le début/reprise pour exclure les fixes antérieurs ; la simulation doit elle aussi produire un nouveau fix. Ne pas toucher aux effets d'accumulation sportive.
- [ ] Relancer les tests hook et service ; vérifier nettoyage des timers et non-régression des tests existants.

### Task 3: Présentation et validation

**Files:** modifier `mobile-ionic/src/pages/Map.tsx` ; créer `mobile-ionic/src/services/livePacePresentation.ts` et `livePacePresentation.test.ts` pour tester le libellé sans monter Mapbox.

**Interfaces:** `getLivePaceCaption(state: LivePaceState): string`, consommé par Map pour la légende sous « Rythme réel ».

- [ ] Tester les textes exacts : moving → `min/km • à cet instant`, stopped → `À l'arrêt`, unavailable → `Signal GPS indisponible`, paused → `En pause`, inactive → `min/km`. Vérifier l'échec avant implémentation.
- [ ] Implémenter le mapping et l'utiliser dans Map ; conserver le texte numérique `--:--` hors mouvement, sans nouvelle carte ni refonte CSS.
- [ ] Lancer les tests ciblés puis `npm --prefix mobile-ionic run test.unit -- --run`, `npm --prefix mobile-ionic run lint` et `npm --prefix mobile-ionic run build`.
- [ ] Appliquer Prettier uniquement aux fichiers modifiés puis contrôler leur format et `git diff --check`. Consigner séparément les erreurs globales préexistantes sans reformatage large.
- [ ] Faire une revue du diff : aucun changement de seuil GPS, de distance ou d'XP ; tous les consommateurs de l'allure restent compatibles.
- [ ] Demander une validation terrain arrêt/reprise avec plateforme et horodatages console GPS ; ne pas annoncer de gain de latence matériel sans mesure réelle. Documenter résultats et limites, puis attendre l'autorisation de commit/push.

## État

- [x] Approche robuste validée par l'utilisateur.
- [x] Conception et plan rédigés ; cohérence des interfaces et couverture relues.
- [x] Paramètres proposés relus et plan approuvé avant implémentation.

## Résultats d'exécution

- [x] Tâche 1 : service pur testé en rouge puis vert (21 cas).
- [x] Tâche 2 : intégration au hook, expiration, arrêt/reprise et nettoyage des timers testés en rouge puis vert.
- [x] Tâche 3 : légendes statistiques, composant HUD carte et validations automatisées.
- [x] Revue indépendante réalisée en lecture seule sur le diff non committé et les nouveaux fichiers.
- [ ] Validation physique Android/navigateur : reste à effectuer par l'utilisateur.
- [x] Commit/push et ouverture de PR autorisés par l'utilisateur après présentation des résultats ; worktree conservé pour les tests terrain.

### Décisions de revue

- Le worktree natif avait initialement un ancien checkout de develop. La branche locale d'origine `fix/security-independent` a été importée sans modifier les références distantes pour retrouver exactement la base examinée (`9fe1387`).
- Le manque de légende d'état dans le HUD carte a été reclassé important : cette surface est utilisée pendant la course. Extraction de `components/LivePaceMetric.tsx` et ajout de quatre tests de rendu rouge → vert, sans changement du suivi sportif.
- Revue du diff non committé plutôt que d'une plage de commits : au moment de la revue, aucun commit ni push n'avait été autorisé.
- Latence physique, comportement en arrière-plan et consommation non certifiés sans appareil ; les seuils pourront nécessiter un ajustement terrain.

### Points mineurs différés

- Ajouter des scénarios explicites de passage simulation → GPS réel périmé et pause/reprise en simulation ; aucune anomalie constatée à la lecture, simulation et expiration couvertes séparément.
- Harmoniser les anciens timestamps des tests distance/dénivelé ; les nouveaux tests d'allure utilisent une horloge cohérente et vérifient leurs résultats numériques.

### Vérification finale

- `npm test` : 193 tests réussis (182 mobile, 11 API).
- Lint mobile, contrôle Prettier global et `git diff --check` : réussis.
- Build TypeScript/Vite : réussi ; avertissements existants sur CSS Ionic, taille de bundle et temps des plugins conservés.
- Aucun réglage GPS, dépendance, calcul distance/XP ni fichier API modifié.

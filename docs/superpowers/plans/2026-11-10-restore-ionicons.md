# Restore Ionicons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurer les anciennes Ionicons du mobile sans toucher aux changements GPS de la branche.

**Architecture:** Utiliser `git revert` sur les six commits Line MD, dans l’ordre inverse, afin de produire un historique non destructif. Vérifier ensuite que les ressources et composants Line MD ont disparu et que l’application compile avec les anciennes icônes.

**Tech Stack:** Git, Ionic React, TypeScript, Vitest, ESLint, Prettier, Vite.

**Spec:** `docs/superpowers/specs/2026-11-10-restore-ionicons-design.md`

## Global Constraints

- Ne pas réécrire l’historique Git et ne jamais forcer le push.
- Préserver le chantier GPS et tous les commits antérieurs à `9d0cdd0`.
- Laisser la PR #13 ouverte et non fusionnée.

## Review Focus

- Vérifier qu’aucun fichier GPS ou API n’est modifié par les reverts.
- Vérifier que `LineMdIcon`, `lineMdMappings` et les SVG Line MD disparaissent.
- Vérifier que les imports `IonIcon` et `ionicons/icons` sont restaurés dans l’application.
- Vérifier qu’aucun conflit de revert n’est résolu en supprimant des changements non liés.
- Vérifier que tests, lint, formatage et build restent valides.

---

### Task 1: Restaurer les anciennes icônes

**Files:**
- Restore: fichiers mobiles et documentation modifiés par les six commits Line MD
- Delete: `mobile-ionic/src/components/LineMdIcon.tsx`, `LineMdIcon.css`, `LineMdIcon.test.tsx`, `lineMdMappings.ts`
- Delete: `mobile-ionic/public/icons/line-md/`

**Interfaces:**
- Consumes: historique Git de `9d0cdd0` à `617344a`
- Produces: application utilisant à nouveau `IonIcon` et `ionicons/icons`

- [ ] **Step 1: Vérifier l’état et la portée des commits**

Run: `git status -sb && git log --oneline --reverse 9d0cdd0^..617344a`
Expected: les six commits Line MD sont présents et aucun changement suivi non lié ne bloque le revert.

- [ ] **Step 2: Annuler les commits dans l’ordre inverse**

Run: `git revert --no-edit 617344a 8bfc859 2f32896 1c45413 2a5e98e 9d0cdd0`
Expected: six commits de revert, sans conflit.

- [ ] **Step 3: Contrôler la restauration**

Run: recherches Git sur `LineMdIcon`, `lineMdMappings`, `IonIcon` et `ionicons/icons`, puis `git diff 4f5412c..HEAD -- mobile-ionic/src mobile-ionic/public/icons/line-md`
Expected: aucune infrastructure Line MD restante ; les anciennes Ionicons sont présentes ; les changements fonctionnels GPS ne sont pas annulés.

### Task 2: Valider et publier le retour arrière

**Files:**
- Modify: description de la PR #13 uniquement sur GitHub

**Interfaces:**
- Consumes: restauration de Task 1
- Produces: branche distante vérifiée et PR documentée

- [ ] **Step 1: Exécuter les validations complètes**

Run: `npm --prefix mobile-ionic run format:check && npm --prefix mobile-ionic run lint && npm --prefix mobile-ionic run test.unit -- --run && npm --prefix mobile-ionic run build`
Expected: toutes les commandes réussissent ; seuls les avertissements de build préexistants sont acceptés.

- [ ] **Step 2: Vérifier le diff et pousser**

Run: `git status -sb && git diff HEAD~6..HEAD --check && git push origin fix/gps-live-pace`
Expected: branche poussée sans force.

- [ ] **Step 3: Mettre à jour la PR #13**

Indiquer que la migration Line MD a été retirée à la demande de l’utilisateur et que les anciennes Ionicons sont restaurées. Ne pas fusionner la PR.

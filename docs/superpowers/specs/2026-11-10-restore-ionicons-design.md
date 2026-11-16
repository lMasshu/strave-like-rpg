# Restauration des Ionicons

## Intention

Revenir aux anciennes Ionicons dans toute l’application mobile, sans modifier le chantier GPS ni réécrire l’historique partagé de la branche.

## Approches considérées

- **Reverts Git des commits Line MD — retenue :** annuler, dans l’ordre inverse, les six commits dédiés à la migration Line MD. Cette méthode restaure exactement l’état antérieur et garde un historique explicite.
- **Restauration manuelle — écartée :** plus longue et plus risquée, notamment pour les tests, ressources et règles documentaires répartis dans de nombreux fichiers.
- **Réécriture de branche — écartée :** un reset suivi d’un push forcé détruirait l’historique partagé et pourrait supprimer des changements sans rapport.

## Contraintes

- Conserver tous les commits et comportements GPS antérieurs à `9d0cdd0`.
- Annuler uniquement `617344a`, `8bfc859`, `2f32896`, `1c45413`, `2a5e98e` et `9d0cdd0`, dans cet ordre.
- Ne pas fusionner la PR #13.
- Vérifier formatage, lint, tests et build après restauration.
- Mettre à jour la PR #13 pour signaler le retrait de Line MD.

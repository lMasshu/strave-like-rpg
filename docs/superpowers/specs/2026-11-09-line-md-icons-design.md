# Harmonisation des icônes Line MD

## Intention

Remplacer les Ionicons actuellement visibles dans l’application mobile par des équivalents issus de la collection Line MD, afin d’obtenir un langage visuel homogène avec la charte sobre, sportive et naturelle de Stride Quest.

## Approches considérées

- **SVG Line MD stockés localement — retenue :** n’embarquer que les icônes utilisées, sans CDN ni dépendance d’exécution, avec un composant React commun.
- **Package Iconify embarqué — écartée :** intégration simple, mais dépendance supplémentaire et contrôle moins explicite des ressources livrées.

## Conception approuvée

- Inventorier tous les usages d’`IonIcon` et leur rôle sémantique.
- Télécharger depuis `line-md` uniquement les SVG nécessaires et les versionner dans les ressources du mobile.
- Fournir un composant React partagé qui conserve `currentColor`, la taille héritée et les attributs d’accessibilité.
- Remplacer les icônes existantes par leur équivalent sémantique Line MD, sans forcer un remplacement lorsqu’aucun équivalent pertinent n’existe.
- Conserver des animations discrètes uniquement lorsqu’elles renforcent l’état ou l’action, et respecter `prefers-reduced-motion`.
- Ajouter à `AGENTS.md` la règle suivante pour les futures modifications : privilégier Line MD, stocker les SVG localement, ne jamais charger une icône depuis un CDN, et fournir un nom accessible aux actions sans texte.

## Contraintes et non-objectifs

- Ne pas modifier la navigation, les comportements métier ni le contenu textuel.
- Préserver la palette Ionic, le mode sombre, les contrastes et les dimensions tactiles actuelles.
- Ne pas convertir les illustrations, avatars, images ou symboles métier qui ne sont pas des icônes d’interface.
- Vérifier les tests, le lint, le formatage et le build mobile après migration.

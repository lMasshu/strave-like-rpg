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
- Remplacer toutes les icônes existantes par l’équivalent sémantique Line MD le plus proche. Lorsque la collection ne propose pas de glyphe littéral, utiliser un symbole voisin et documenter la correspondance ci-dessous.
- Livrer des SVG statiques : les éléments SMIL sont résolus sur leur image finale afin que le rendu en masque CSS soit complet et qu’aucune animation ne subsiste, ce qui respecte `prefers-reduced-motion` par construction.
- Ajouter à `AGENTS.md` la règle suivante pour les futures modifications : privilégier Line MD, stocker les SVG localement, ne jamais charger une icône depuis un CDN, et fournir un nom accessible aux actions sans texte.

## Correspondances retenues

Line MD ne fournit pas de glyphes littéraux pour plusieurs concepts sportifs ou RPG. La correspondance suivante est volontaire : elle privilégie une seule famille visuelle et un symbole compréhensible dans son contexte.

| Usage d’origine | Icône Line MD | Raison |
| :--- | :--- | :--- |
| Flamme, énergie, raid | `alert` | Pas de flamme dans Line MD ; le triangle signale l’intensité ou le danger. |
| Crâne, boss | `alert` | Pas de crâne ; même registre de danger. |
| Marche, vélo, course, activité | `speed` | Pas de glyphes sportifs ; compteur de vitesse commun, partagé volontairement. |
| Dé, aléatoire | `circle` | Pas de dé ; cercle neutre pour l’action de génération. |
| Trophée, ruban, badge | `star` | Pas de trophée ni de ruban ; étoile de récompense. |
| Cadenas, verrouillé | `security` | Pas de cadenas ; bouclier de sécurité. |
| Cible, enregistrement | `circle` | Pas de cible ; cercle d’enregistrement. |
| Drapeau, défis | `star` | Pas de drapeau ; étoile de défi. |
| Étincelles | `star` | Pas d’étincelles ; étoile de mise en avant. |
| Outils, construction | `construction` | Équivalent littéral disponible. |
| Accueil, carte, position, boussole, horloge, validation, fermeture, chevron, cœur, lecture, répétition, tendance, cloche, soleil, lune, profil, ajout d’ami | `home`, `map-marker-radius`, `my-location`, `compass`, `watch`, `confirm`, `close`/`close-circle`, `chevron-small-right`, `heart`, `play`, `rotate-180`, `arrow-up`, `bell`, `sunny`, `moon`, `account`, `account-add` | Équivalents littéraux ou sémantiques directs. |

Les collisions `speed` (marche/vélo/course) et `star` (trophée/ruban/badge) sont assumées pour conserver une seule collection embarquée ; elles pourront être séparées si Line MD ajoute des glyphes dédiés.

L’état actif des onglets utilise `--sq-tab-selected` : `#3f6212` en thème clair pour rester lisible sur fond clair, `#aff33e` en thème sombre. L’indicateur supérieur et le libellé actif partagent cette couleur.

## Contraintes et non-objectifs

- Ne pas modifier la navigation, les comportements métier ni le contenu textuel.
- Préserver la palette Ionic, le mode sombre, les contrastes et les dimensions tactiles actuelles.
- Ne pas convertir les illustrations, avatars, images ou symboles métier qui ne sont pas des icônes d’interface.
- Vérifier les tests, le lint, le formatage et le build mobile après migration.

# GEKKO Token Scaler

Module **Foundry VTT V14** pour ajuster la hauteur visuelle des personnages selon leur taille réelle.

**Version actuelle : 0.1.6** — prototype en français.

## Installation avec mises à jour Foundry

Dans Foundry VTT : **Modules complémentaires → Installer un module → URL du manifeste**, coller :

```text
https://raw.githubusercontent.com/thegexgekko/GEKKO-Token-Scaler/main/module.json
```

Valider, puis activer le module dans le monde de jeu. Les versions suivantes peuvent ensuite être détectées par le système de mise à jour de Foundry lorsque le manifeste et une nouvelle publication GitHub sont disponibles.

## Utilisation

Dans **Paramètres du module**, choisir une référence commune (par défaut **1,80 m = 2,50 cases**). Sélectionner ensuite un token et cliquer sur l’icône règle dans son HUD (colonne de gauche) ou la barre d'outils Tokens. Saisir la taille du personnage, par exemple `1,70`, puis choisir **Appliquer**.

Le module ajuste les dimensions du token et conserve ses proportions. Le mode « Adapter le cadre à l’image » modifie aussi l’espace occupé sur la grille et les collisions ; désactivé, il préserve cette surface mais l’image peut dépasser le cadre. Le bouton **Restaurer** permet de revenir aux dimensions mémorisées.

**Compatibilité Visage** : une apparence Visage qui impose elle-même les dimensions ou l’échelle empêche le redimensionnement. Décocher les réglages de taille dans l’apparence Visage, en conservant l’image. Les explications sont disponibles dans l’aide des paramètres du module.

## Limitations de la V0.1.6

- Module destiné aux MJ et tokens classiques (pas aux anneaux dynamiques).
- Compatibilité avec Foundry V14 ; l’intégration avec Visage peut dépendre des réglages de chaque apparence.
- La sortie a été testée avec 25 tests Node.js ; le fonctionnement dans un monde réel reste à valider pour chaque configuration.

## Développement et versions

Tests : `node --test tests/*.test.mjs`

Les sources sont à la racine du dépôt. Le workflow GitHub Actions `.github/workflows/release.yml` construit automatiquement le ZIP `gekko-token-scaler.zip` et publie une **GitHub Release** portant le numéro de version du `module.json`. Pour publier une nouvelle version, modifier le champ `version` du manifeste, tester, puis pousser les modifications sur `main`.

**Licence** : MIT © 2026 GEKKO.

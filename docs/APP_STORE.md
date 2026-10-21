# GolfUs — conformité App Store (étape 4)

État au 21 octobre 2026. Ce document prépare les réponses à saisir dans App Store Connect ; c'est vous qui les validez.

## 1. Règles vérifiées

| Règle Apple | Exigence | Dans GolfUs |
|---|---|---|
| 5.1.1 (v) | Supprimer son compte depuis l'app | Profil › Mes données › Supprimer mon compte (définitif, données effacées). Compte Apple : accès révoqué chez Apple si la clé `APPLE_SIWA_*` est configurée |
| 5.1.1 / RGPD | Accès aux données | Profil › Mes données › Télécharger mes données : lien de 5 minutes ouvert dans Safari intégré (fichier JSON) |
| 5.1.1 (iv) | Autorisations demandées au bon moment, textes clairs | Localisation : à l'ouverture de la recherche (fonction principale), texte FR/EN/ES. Notifications : seulement au clic sur « Activer » |
| 1.2 | Contenus des utilisateurs | Filtre automatique (prénoms, avis, messages), bouton « Signaler » (avis, joueurs, invitations), blocage des joueurs, conditions avec tolérance zéro (`/conditions`), traitement sous 24 h dans /admin › Signalements, avis masqué après 3 signalements |
| 4.8 | « Se connecter avec Apple » si une connexion tierce est proposée | Dans l'app, seule la connexion e-mail est proposée (Google désactivé), donc non obligatoire ; « Se connecter avec Apple » est tout de même présent |
| 5.1.2 | Politique de confidentialité | https://golfus.ch/confidentialite (lien aussi dans l'app : Profil), à jour des comptes, notifications et signalements |
| 1.5 | URL d'assistance avec moyen de contact | https://golfus.ch/aide : questions fréquentes et formulaire, messages dans /admin › Messages |
| 2.1 | App complète, compte de démonstration pour l'examen | **À TOI** : créer un compte de test et le donner dans « App Review Information » |
| 2.3 / exactitude | Pas de données trompeuses | Golfs de démonstration retirés en ligne le 21 octobre 2026 : seules les fiches vérifiées s'affichent |
| 4.2 | Pas un simple site emballé | Voir section 4 |

## 2. « App Privacy » (Confidentialité de l'app)

Pas de pistage (*tracking*) : **Non**. Aucune publicité, aucun outil d'analyse, aucun SDK tiers de collecte.

| Catégorie Apple | Donnée | Liée à l'utilisateur | Usage |
|---|---|---|---|
| Coordonnées › Adresse e-mail | e-mail du compte | Oui | Fonctionnement de l'app |
| Coordonnées › Nom | prénom | Oui | Fonctionnement de l'app |
| Contenu utilisateur › Photos | photo de profil (facultative) | Oui | Fonctionnement de l'app |
| Contenu utilisateur › Autre contenu | avis, messages d'invitation | Oui (avis : non, ils sont anonymes) | Fonctionnement de l'app |
| Identifiants › Identifiant utilisateur | identifiant de compte | Oui | Fonctionnement de l'app |
| Localisation › Position précise | position envoyée au serveur pour chercher les golfs proches, jamais enregistrée ni liée au compte | Non | Fonctionnement de l'app |

Le serveur n'enregistre pas la position et n'en transmet qu'une version arrondie (~1 à 11 km) aux services de carte et
d'itinéraire. Apple demande toutefois de déclarer une donnée envoyée hors de l'appareil : « Position précise, non liée » est
la réponse prudente.

## 3. Classification par âge (questionnaire)

Réponses proposées : aucune violence, aucun contenu sexuel, aucun jeu d'argent, aucun accès web libre (les liens externes
s'ouvrent dans Safari intégré vers les sites des golfs), **contenu généré par les utilisateurs : oui** (avis, prénoms,
messages d'invitation, avec filtre, signalement et blocage). Classification probable : **13+** (Apple calcule le résultat).

## 4. Risque « 4.2 — fonctionnalités minimales »

GolfUs réutilise le code du site : c'est le point le plus souvent reproché aux apps Capacitor.

**Ce qui réduit le risque**
- L'interface est embarquée dans l'app (pas de chargement d'un site distant) et respecte les zones sûres et la barre d'état.
- Fonctions natives réelles : localisation native, notifications push (invitation, réponse, annulation, rappel la veille),
  feuille de partage iOS, retour haptique, Keychain pour la session, « Se connecter avec Apple », Universal Links,
  Safari intégré pour les sites externes.
- Valeur propre à l'app : organiser une partie et être prévenu en temps réel, ce que le site ne fait pas.

**Ce qui reste un risque (moyen)** : l'examinateur peut juger l'app proche du site. Pour le réduire avant la soumission :
1. Activer les notifications (clé APNs) pour que l'examinateur les voie fonctionner.
2. Dans les notes pour l'examen, décrire le parcours : rechercher → organiser une partie → l'ami reçoit une notification.
3. Fournir un compte de démonstration avec un ami et une partie déjà créés.

## 5. À TOI avant la soumission

1. **Mentions légales** : compléter l'éditeur (nom, adresse, e-mail de contact) dans `src/pages/LegalPages.tsx`. Apple exige
   un moyen de contact pour les contenus des utilisateurs. Donnez-moi ces informations et je les intègre.
2. **Xcode › Signing & Capabilities** : ajouter « Sign in with Apple » (en plus de Push Notifications et Associated Domains).
3. **Facultatif** : clé « Sign in with Apple » (developer.apple.com › Keys) → `APPLE_SIWA_KEY_ID`, `APPLE_SIWA_PRIVATE_KEY`
   dans Netlify, pour révoquer l'accès Apple quand un compte est supprimé (recommandé par Apple).
4. **Compte de démonstration** pour l'examen : à créer vous-même sur golfus.ch.
5. **Modération** : consulter /admin › Signalements et /admin › Messages chaque jour (engagement de traitement sous 24 h).

Textes de la fiche, captures d'écran et notes pour l'examen : `docs/app-store/FICHE.md`.

# ⛳ Golfus

Trouvez et comparez les golfs autour de votre lieu de vacances : distance et temps de trajet, horaires d'ouverture,
statut « ouvert / fermé », tarifs green fee (basse / haute saison, semaine / week-end), le tout sur une carte interactive.

**100 % gratuit** : aucune clé d'API n'est nécessaire (OpenStreetMap, Photon, Nominatim, OSRM, taux BCE).

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Variables d'environnement](#variables-denvironnement)
5. [Lancement](#lancement)
6. [Administration des tarifs](#administration-des-tarifs)
7. [Données de démonstration](#données-de-démonstration)
8. [Déploiement](#déploiement)
9. [Sources de données et limites](#sources-de-données-et-limites)
10. [Confidentialité](#confidentialité)

---

## Fonctionnalités

| Domaine | Détail |
|---|---|
| Localisation | Bouton « Me localiser » (API Geolocation, haute précision puis repli réseau, état de permission vérifié, repli par IP ou saisie), recherche ville / adresse / hôtel avec autocomplétion, rayon 10 / 25 / 50 / 100 km |
| Résultats | Cartes triées par distance : photo, distance + temps de trajet, trous, par, note, green fee, horaires du jour, statut ouvert/fermé |
| Actions | Itinéraire (Plans sur iPhone, Google Maps ailleurs), Appeler, Site web, Réserver |
| Carte | Leaflet + OpenStreetMap, marqueurs cliquables synchronisés avec la liste, cercle du rayon |
| Filtres / tri | Tri distance / prix / note ; prix max, 9 ou 18 trous, ouvert à l'heure choisie, location de clubs, practice, restaurant, voiturette |
| Date de jeu | Choix de la date et de l'heure : statut d'ouverture et tarif (saison, semaine / week-end) recalculés |
| Fiche détaillée | Description, photos, parcours (par, longueur, difficulté), tableau complet des tarifs, horaires de la semaine, services, coordonnées, avis |
| Extras | Favoris (localStorage), partage (Web Share API / copie du lien), FR / EN / ES, devises EUR / CHF / USD / GBP |
| Design | « Liquid Glass » glacé (voir ci-dessous), mobile-first, carte plein écran + tiroir de verre à 3 crans, panneau de verre sur desktop, mode clair / sombre |
| Accessibilité | Contrastes AA, navigation clavier (combobox, boîtes de dialogue, groupes radio), labels ARIA, lien d'évitement |

**Règle d'or : rien n'est inventé.** Un prix ou un horaire absent est affiché « Non communiqué », avec un bouton
pour appeler le golf (si son numéro est connu) et un lien vers sa page tarifs (si elle est renseignée).
Un tarif non confirmé porte la mention **« Tarif indicatif — à confirmer auprès du golf »**.

## Design « Liquid Glass »

- **Palette** (tokens dans `src/index.css`) : fond `#F5F9FC → #E3EEF7`, verre `rgba(255,255,255,.55)` / `rgba(20,28,38,.45)`,
  bleu glacier `#7FB6E6`, vert golf `#1F5D4A` (boutons principaux, « Ouvert »), champagne `#D9C7A0` (étoiles, favoris).
- **Classes** : `.glass` (flou 24 px + saturation 180 %, liseré, reflet spéculaire `::before`), `.glass-interactive`
  (s'éclaire, s'élève de 2 px, `scale(.97)` à l'appui), `.frost` (translucide **sans** flou, pour les cartes posées dans
  un panneau de verre : jamais plus de 2–3 flous empilés).
- **Carte** : tuiles OpenStreetMap recolorées en CSS (désaturées, bleu-gris ; inversées la nuit), marqueurs « pastille
  de prix » regroupés en grappes (`leaflet.markercluster`).
- **Mouvement** : easing `cubic-bezier(0.22, 1, 0.36, 1)`, 250–450 ms ; apparition en cascade (40 ms) ; transition
  partagée photo → fiche (View Transitions API) ; tiroir à inertie ; indicateur « goutte » dans la barre de navigation ;
  vibration légère sur Android.
- **Composants** (`src/components/glass.tsx`) : `GlassCard`, `GlassButton`, `GlassPill`, `GlassInput`, `GlassSheet`
  (tiroir), `GlassNavBar` (navigation), et `GlassFx` qui détecte les capacités du navigateur :
  - **réfraction réelle** sur Chrome / Edge : filtre SVG `feTurbulence` + `feDisplacementMap` utilisé dans
    `backdrop-filter: url(#glass-distortion)` (classe `.glass-refract` : barre de recherche, tiroir, navigation) ;
    Safari et Firefox gardent le flou + saturation classique ;
  - **halos** bleu glacier / émeraude / champagne animés très lentement derrière l'interface ;
  - **reflet spéculaire** qui suit la souris (ordinateur) ou l'inclinaison du téléphone (Android ; iOS exige une
    autorisation, donc reflet fixe) ; liseré lumineux `::after`.
- `.glass-strong` : voile plus opaque pour les blocs de texte posés sur un fond chargé (contraste AA).
- **Garde-fous** : `prefers-reduced-motion` (animations et halos coupés), `prefers-reduced-transparency` (surfaces
  opaques), repli sans `backdrop-filter`, réfraction désactivée sur les appareils à moins de 4 Go de mémoire, au plus
  2 couches de flou empilées, cibles tactiles ≥ 44 px, focus visible. Audit axe-core WCAG A/AA : 0 violation.
- Captures avant / après : `docs/captures/`.

## Architecture

```
golfus/
├── shared/types.ts          Types partagés client / serveur
├── server/                  API Express (Node ≥ 22.13), proxy des services externes
│   ├── index.ts             Point d'entrée (sert aussi le front en production)
│   ├── config.ts            Lecture des variables d'environnement
│   ├── auth.ts              Session admin (cookie httpOnly signé HMAC)
│   ├── db/index.ts          Schéma SQLite (module natif node:sqlite, sans dépendance)
│   ├── db/seed.ts           Golfs de DÉMONSTRATION
│   ├── lib/                 Cache 24 h, HTTP, limiteur de débit, validation…
│   ├── services/            OSM (Overpass + repli Nominatim), géocodage, itinéraires, taux, golfs
│   └── routes/              Routes publiques et admin
├── src/                     Front React + Vite + TypeScript + Tailwind CSS v4
│   ├── components/          Carte, tiroir, cartes de golf, filtres, recherche…
│   ├── pages/               Accueil, fiche, favoris, mentions légales, admin
│   ├── lib/                 API, horaires (opening_hours), tarifs, devises, favoris…
│   ├── i18n/                fr.ts (référence), en.ts, es.ts
│   └── state/search.tsx     État de recherche (en mémoire uniquement)
├── data/                    Base SQLite (créée automatiquement, ignorée par git)
├── Dockerfile, render.yaml, netlify.toml, vercel.json
└── .env.example
```

```
Navigateur ──/api──▶ Express ──▶ cache SQLite (24 h) ──▶ Overpass / Nominatim / Photon / OSRM / BCE
                        └──────▶ base locale (tarifs, services, corrections, avis) fusionnée par-dessus OSM
```

- Les clés éventuelles (OpenRouteService) restent côté serveur, dans `.env`. Le navigateur n'appelle que `/api`.
- Chaque réponse d'API externe est mise en cache 24 h dans SQLite. Si un service tombe, le dernier
  résultat connu est resservi (avec un bandeau d'avertissement).
- Les données saisies dans l'admin sont prioritaires sur celles d'OpenStreetMap, champ par champ.

## Installation

Prérequis : **Node.js 22.13 ou plus récent** (Node 24 LTS recommandé). Vérifiez avec `node -v`.

> Sur ce Mac, Node 24 LTS a été installé dans `~/.local/node` et ajouté au `PATH` via `~/.zshrc`.
> Ouvrez un nouveau terminal pour qu'il soit pris en compte.

```bash
npm install
cp .env.example .env      # puis éditez .env (voir ci-dessous)
npm run seed              # insère les golfs de démonstration (facultatif)
```

## Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `API_PORT` | non (8787) | Port de l'API en développement. En production, `PORT` (fourni par l'hébergeur) est utilisé s'il est vide |
| `ADMIN_PASSWORD` | pour l'admin | Mot de passe de `/admin`. Si absent ou égal à `change-moi`, l'admin est désactivée |
| `ADMIN_SESSION_SECRET` | pour l'admin | Secret de signature des sessions (16 caractères minimum). `openssl rand -base64 36` |
| `DATABASE_PATH` | non | Fichier SQLite (défaut `./data/golfus.db`) |
| `SHOW_DEMO_DATA` | non (true) | Afficher les golfs de démonstration |
| `CACHE_TTL_HOURS` | non (24) | Durée du cache des API externes |
| `CONTACT_EMAIL` | **avant mise en ligne** | Adresse de contact envoyée dans le User-Agent (exigé par les conditions OSM / Nominatim) |
| `OVERPASS_URLS` | non | Serveurs Overpass essayés dans l'ordre |
| `OSRM_URL` | non | Serveur d'itinéraires OSRM (démo publique par défaut) |
| `ORS_API_KEY` | non | Clé gratuite [OpenRouteService](https://openrouteservice.org/dev/#/signup), plus fiable qu'OSRM démo |
| `VITE_API_BASE` | non | (Build du front) URL de l'API si elle est sur un autre domaine sans réécriture `/api` |

Le fichier `.env` livré contient déjà un mot de passe admin et un secret aléatoires.

## Lancement

```bash
npm run dev        # API (http://localhost:8787) + front (http://localhost:5173) avec rechargement à chaud
```

Production locale :

```bash
npm run build      # vérification TypeScript + build du front dans dist/
npm start          # une seule application Node sert le front et l'API sur API_PORT / PORT
```

Autres scripts : `npm run typecheck`, `npm run seed`, `npm run seed -- --clear` (supprime les données de démo).

### Tester sur téléphone (géolocalisation)

La géolocalisation n'est autorisée par les navigateurs qu'en **https** ou sur `localhost`. Ouvrir
`http://192.168.x.x:5173` depuis le téléphone ne marchera donc pas : il faut un tunnel https vers votre Mac.

1. Lancez l'application : `npm run dev`.
2. Dans un second terminal, ouvrez un tunnel (au choix) :
   - **localhost.run**, sans rien installer (SSH est inclus dans macOS) :
     ```bash
     ssh -R 80:localhost:5173 nokey@localhost.run
     ```
   - **Cloudflare Tunnel** (après `brew install cloudflared` ou téléchargement sur cloudflare.com) :
     ```bash
     cloudflared tunnel --url http://localhost:5173
     ```
   - **ngrok** (compte gratuit) : `ngrok http 5173`.
3. Ouvrez sur le téléphone l'adresse `https://….lhr.life`, `https://….trycloudflare.com` ou `https://….ngrok-free.app` affichée.
   Ces domaines sont déjà autorisés dans `vite.config.ts` (`server.allowedHosts`).
4. Touchez « Me localiser » et acceptez la demande d'autorisation.

⚠️ Le tunnel rend votre serveur de développement accessible publiquement tant qu'il est ouvert : fermez-le après le test
(Ctrl+C). Autre option : déployer une version de test (voir « Déploiement »).

**Si la localisation est refusée ou échoue**, l'application explique comment réactiver l'autorisation (iPhone, Android,
ordinateur) et propose deux replis : saisir une ville, ou « Position approximative » (ville estimée par l'adresse IP via
ipwho.is / GeoJS, uniquement sur demande, non enregistrée).

## Administration des tarifs

1. Ouvrez `/admin` et connectez-vous avec `ADMIN_PASSWORD`.
2. Pour compléter un golf OpenStreetMap : ouvrez sa fiche dans l'application, puis cliquez sur
   **« Compléter cette fiche (admin) »** en bas de page (visible une fois connecté). Vous pouvez aussi coller son lien
   OpenStreetMap dans l'admin.
3. Pour un golf absent d'OSM : **« Créer un golf absent d'OpenStreetMap »** (nom + latitude/longitude obligatoires).

Champs disponibles :

- **Tarifs** : lignes libres (catégorie × saison × jours × montant × devise × remarque), avec des boutons pour
  ajouter d'un clic une grille 18 trous ou 9 trous (basse / haute saison × semaine / week-end).
- **Mois de haute saison** : ils déterminent le tarif applicable à la date de jeu choisie.
- **Fiabilité** : *Vérifié* (avec la date de vérification) ou *Indicatif* (affiche « à confirmer auprès du golf »).
- **Page tarifs officielle** : lien affiché à côté du prix.
- **Horaires** au format OSM `opening_hours` (ex. `Mo-Su 08:00-19:00`, `Apr-Oct Mo-Su 08:00-20:00; Nov-Mar off`),
  validés en direct, avec un aperçu de la semaine.
- Coordonnées, lien de réservation, descriptions FR/EN/ES, photos (URL), parcours, services, modération des avis.

Les champs laissés vides reprennent les données OpenStreetMap.

## Données de démonstration

`npm run seed` insère **8 golfs FICTIFS**, clairement marqués « Démo » / « Golf fictif — données de démonstration » :

| Région | Golfs |
|---|---|
| Marbella | Golf Démo Sierra Blanca (18 t.), Club de Golf Démo El Pinar (9 t.) |
| Algarve | Golfe Démo Atlântico (18 t.), Golfe Démo Ponta da Rocha (18 t., **sans horaires** pour illustrer « Non communiqué ») |
| Côte d'Azur | Golf Démo des Collines d'Azur (18 t.), Golf Démo de l'Estérel Bleu (9 t., **sans tarifs**) |
| Suisse romande | Golf Démo Lavaux-Léman (18 t., CHF, fermé l'hiver), Golf Démo du Mandement (9 t., CHF) |

Noms, prix, horaires et avis sont inventés. Aucun numéro de téléphone n'est fourni (pour ne jamais appeler un vrai
numéro par erreur) et les liens pointent vers `example.com`. Masquez-les avec `SHOW_DEMO_DATA=false` ou supprimez-les avec
`npm run seed -- --clear`.

## Déploiement

L'application a besoin d'un **processus Node permanent avec un disque persistant** (SQLite). Les fonctions serverless
de Vercel et Netlify ont un système de fichiers éphémère : la base y serait perdue. Deux options :

### Option A — Tout-en-un sur Render, Railway, Fly.io ou un VPS (recommandé)

**Render** : le fichier `render.yaml` est fourni.

1. Poussez le projet sur GitHub.
2. Sur Render, choisissez *New → Blueprint*, sélectionnez le dépôt, puis renseignez `ADMIN_PASSWORD` et `CONTACT_EMAIL`.
3. Le disque persistant monté sur `/var/data` conserve la base. Il nécessite l'offre *Starter*, environ 7 $/mois.

**Docker** (VPS, Fly.io, Railway…) :

```bash
docker build -t golfus .
docker run -p 8787:8787 -v golf-data:/data --env-file .env golfus
```

### Option B — Front sur Vercel ou Netlify, API ailleurs

1. Déployez l'API comme dans l'option A.
2. Dans `vercel.json` ou `netlify.toml`, remplacez `https://VOTRE-API.example.com` par l'URL de l'API.
   La réécriture `/api/*` garde un même domaine, ce qui fait fonctionner le cookie d'administration.
3. **Vercel** : *Import Project*. Le build et la sortie sont déjà configurés. **Netlify** : *Add new site → Import*.

### Avant une mise en ligne publique

- Renseignez `CONTACT_EMAIL`, un `ADMIN_PASSWORD` robuste et un `ADMIN_SESSION_SECRET` aléatoire.
- Complétez la page **Mentions légales** (`src/pages/LegalPages.tsx` : éditeur, hébergeur, contact).
- En cas de trafic important, respectez les conditions d'usage des services gratuits :
  - [tuiles OSM](https://operations.osmfoundation.org/policies/tiles/) : passez éventuellement à un fournisseur de tuiles
    (MapTiler, Stadia…) dans `src/components/MapView.tsx` ;
  - [Nominatim](https://operations.osmfoundation.org/policies/nominatim/) : 1 requête par seconde, respectée par le serveur ;
  - OSRM démo : passez à `ORS_API_KEY` ou à votre propre serveur OSRM.

## Sources de données et limites

| Donnée | Source | Remarques |
|---|---|---|
| Golfs, téléphone, site, horaires, adresse | OpenStreetMap via **Overpass**, repli automatique sur **Nominatim** | Complétude variable : les horaires sont souvent absents, d'où l'admin |
| Photos | Wikimedia Commons (tags OSM `image` / `wikimedia_commons`) ou URL saisies dans l'admin | Sinon, illustration neutre |
| Autocomplétion | **Photon** (Komoot) | Nominatim interdit l'autocomplétion à la frappe |
| Nom de ville après géolocalisation | Nominatim (reverse) | Position arrondie à environ 1 km |
| Temps de trajet | **OSRM** (démo) ou OpenRouteService | Estimation « ≈ » si le service est indisponible |
| Tarifs, services, parcours | Base locale (admin) | Aucune API universelle des green fees |
| Notes et avis | Avis déposés par les visiteurs | Pas de note tant qu'il n'y a pas d'avis |
| Devises | Taux BCE via Frankfurter | Montants convertis affichés « ≈ », montant d'origine au survol |

**Limites connues :**

- Les serveurs Overpass publics sont souvent saturés. La première recherche dans une zone peut alors prendre
  jusqu'à 30 s (repli sur Nominatim). Les recherches suivantes passent par le cache et sont instantanées.
- Les horaires sont interprétés dans le fuseau horaire de l'appareil, ce qui convient à un voyageur sur place.
- L'administration est en français uniquement ; l'interface publique est en FR, EN et ES.

## Confidentialité

- La position n'est **jamais stockée** : elle reste en mémoire dans le navigateur, ne va ni dans l'URL ni dans le localStorage,
  et n'est pas journalisée côté serveur.
- Vers OpenStreetMap, seul le centre d'une maille d'environ 11 km est envoyé. Vers les services d'itinéraire et le géocodage
  inverse, la position est arrondie à environ 1 km. Ces appels sont faits par le serveur, donc sans l'adresse IP du visiteur.
- Le cache est indexé par zone, sans aucune donnée liée au visiteur.
- Voir la page `/confidentialite` de l'application.

## Licence des données

Données © contributeurs OpenStreetMap, sous licence [ODbL](https://www.openstreetmap.org/copyright). L'attribution est
affichée sur la carte, dans le pied de page et sur chaque fiche.

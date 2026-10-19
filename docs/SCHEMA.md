# Schéma de base de données — Golf Finder (réseau social simple)

Base **SQLite** (`node:sqlite`), migrations numérotées dans `server/db/migrations.ts` (table `schema_migrations`).
SQLite suffit tant que l'application tourne sur un seul serveur ; Postgres ne serait utile qu'avec plusieurs
instances ou un hébergement serverless.

| Table | Rôle | Index |
|---|---|---|
| `golfs`, `prices`, `api_cache` | (existant) données des golfs, tarifs, cache des API | — |
| `users` | compte : e-mail, prénom, nom d'utilisateur (unique), photo, index (facultatif), langue, code d'invitation, option « ne pas apparaître au classement », fuseau, consentements (CGU, push), `session_version` | unique(email), unique(username), unique(invite_code) |
| `accounts`, `verification_tokens` | Auth.js (Google/Apple, liens magiques — jetons stockés hachés) | pk(provider, provider_account_id) |
| `friendships` | paire d'amis (user_a < user_b), `pending` / `accepted`, qui a demandé | pk, (user_b) |
| `outings` | partie organisée : golf, date, heure, nb de joueurs, message, lien de partage, `active`/`cancelled`, rappel envoyé | (date), unique(share_token) |
| `outing_guests` | invité ami (user_id) ou extérieur (guest_name + jeton) ; réponse `pending`/`yes`/`maybe`/`no` | unique(outing_id,user_id), (user_id) |
| `notifications` | centre de notifications ; `pushed_at` pour l'envoi push | (user_id, id) |
| `push_subscriptions` | abonnements Web Push (PWA) | unique(endpoint), (user_id) |
| `bookings` | réservation lancée depuis Golf Finder (`online`/`request`) ; `started` → `confirmed` **uniquement** si l'utilisateur l'indique | (user_id, status) |
| `golf_comments` | avis : note 1-5 + texte, `visible`/`hidden` | **unique(golf_id, user_id)**, (golf_id, created_at) |
| `comment_reports` | signalements pour la modération /admin | (status), unique(comment_id, reporter_id) |
| `rounds` | partie jouée : golf, date, 9/18 trous, score total, note perso — **privée** | (user_id, played_on), (user_id, golf_id) |
| `round_friends` | amis présents lors de la partie | pk |
| `dev_outbox` | e-mails capturés en développement (sans SMTP) | — |

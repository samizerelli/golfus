import crypto from 'node:crypto';
import type { Adapter, AdapterAccount, AdapterUser, VerificationToken } from '@auth/express/adapters';
import { db } from '../db/index.ts';
import { uuid } from '../lib/ids.ts';

interface UserRow {
  id: string;
  email: string;
  email_verified: string | null;
  name: string | null;
  image: string | null;
}

const toUser = (r: UserRow | undefined): AdapterUser | null =>
  r ? { id: r.id, email: r.email, emailVerified: r.email_verified ? new Date(r.email_verified) : null, name: r.name, image: r.image } : null;

/** Les jetons de vérification sont stockés hachés (SHA-256) : une fuite de la base ne permet pas de se connecter. */
const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

/** Adaptateur Auth.js pour SQLite (node:sqlite). Sessions en JWT : les méthodes de session ne sont pas nécessaires. */
export function SqliteAdapter(): Adapter {
  return {
    async createUser(u) {
      const id = uuid();
      db.prepare('INSERT INTO users (id, email, email_verified, name, image) VALUES (?, ?, ?, ?, ?)').run(
        id,
        u.email.toLowerCase(),
        u.emailVerified ? u.emailVerified.toISOString() : null,
        u.name ?? null,
        u.image ?? null,
      );
      return toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow)!;
    },
    async getUser(id) {
      return toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow | undefined);
    },
    async getUserByEmail(email) {
      return toUser(db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as unknown as UserRow | undefined);
    },
    async getUserByAccount({ provider, providerAccountId }) {
      return toUser(
        db
          .prepare('SELECT u.* FROM users u JOIN accounts a ON a.user_id = u.id WHERE a.provider = ? AND a.provider_account_id = ?')
          .get(provider, providerAccountId) as unknown as UserRow | undefined,
      );
    },
    async updateUser(u) {
      const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id) as unknown as UserRow;
      db.prepare('UPDATE users SET email = ?, email_verified = ?, name = ?, image = ? WHERE id = ?').run(
        (u.email ?? cur.email).toLowerCase(),
        u.emailVerified !== undefined ? (u.emailVerified ? u.emailVerified.toISOString() : null) : cur.email_verified,
        u.name !== undefined ? u.name : cur.name,
        u.image !== undefined ? u.image : cur.image,
        u.id,
      );
      return toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id) as unknown as UserRow)!;
    },
    async deleteUser(id) {
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    },
    async linkAccount(a: AdapterAccount) {
      db.prepare(
        `INSERT OR REPLACE INTO accounts (user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        a.userId,
        a.type,
        a.provider,
        a.providerAccountId,
        a.refresh_token ?? null,
        a.access_token ?? null,
        a.expires_at ?? null,
        a.token_type ?? null,
        a.scope ?? null,
        a.id_token ?? null,
        (a.session_state as string | undefined) ?? null,
      );
    },
    async unlinkAccount({ provider, providerAccountId }) {
      db.prepare('DELETE FROM accounts WHERE provider = ? AND provider_account_id = ?').run(provider, providerAccountId);
    },
    async createVerificationToken(t: VerificationToken) {
      db.prepare('INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)').run(
        t.identifier.toLowerCase(),
        hashToken(t.token),
        t.expires.toISOString(),
      );
      return t;
    },
    async useVerificationToken({ identifier, token }) {
      const row = db
        .prepare('SELECT * FROM verification_tokens WHERE identifier = ? AND token = ?')
        .get(identifier.toLowerCase(), hashToken(token)) as { identifier: string; expires: string } | undefined;
      if (!row) return null;
      db.prepare('DELETE FROM verification_tokens WHERE identifier = ? AND token = ?').run(identifier.toLowerCase(), hashToken(token));
      return { identifier: row.identifier, token, expires: new Date(row.expires) };
    },
  };
}

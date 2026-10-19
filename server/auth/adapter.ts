import crypto from 'node:crypto';
import type { Adapter, AdapterAccount, AdapterUser, VerificationToken } from '@auth/express/adapters';
import { db } from '../db/index.ts';

interface UserRow {
  id: string;
  email: string;
  email_verified: Date | string | null;
  name: string | null;
  image: string | null;
}

const toUser = (r: UserRow | undefined): AdapterUser | null =>
  r ? { id: r.id, email: r.email, emailVerified: r.email_verified ? new Date(r.email_verified) : null, name: r.name, image: r.image } : null;

/** Jetons de vérification stockés hachés (SHA-256) : une fuite de la base ne permet pas de se connecter. */
const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const byId = (id: string) => db.get<UserRow>('SELECT * FROM users WHERE id = ?', id);

/** Adaptateur Auth.js pour Postgres. Sessions en JWT : les méthodes de session ne sont pas nécessaires. */
export function PostgresAdapter(): Adapter {
  return {
    async createUser(u) {
      const id = crypto.randomUUID();
      await db.run('INSERT INTO users (id, email, email_verified, name, image) VALUES (?, ?, ?, ?, ?)', id, u.email.toLowerCase(), u.emailVerified ?? null, u.name ?? null, u.image ?? null);
      return toUser(await byId(id))!;
    },
    async getUser(id) {
      return toUser(await byId(id));
    },
    async getUserByEmail(email) {
      return toUser(await db.get<UserRow>('SELECT * FROM users WHERE email = ?', email.toLowerCase()));
    },
    async getUserByAccount({ provider, providerAccountId }) {
      return toUser(
        await db.get<UserRow>('SELECT u.* FROM users u JOIN accounts a ON a.user_id = u.id WHERE a.provider = ? AND a.provider_account_id = ?', provider, providerAccountId),
      );
    },
    async updateUser(u) {
      const cur = (await byId(u.id))!;
      await db.run(
        'UPDATE users SET email = ?, email_verified = ?, name = ?, image = ? WHERE id = ?',
        (u.email ?? cur.email).toLowerCase(),
        u.emailVerified !== undefined ? u.emailVerified : cur.email_verified,
        u.name !== undefined ? u.name : cur.name,
        u.image !== undefined ? u.image : cur.image,
        u.id,
      );
      return toUser(await byId(u.id))!;
    },
    async deleteUser(id) {
      await db.run('DELETE FROM users WHERE id = ?', id);
    },
    async linkAccount(a: AdapterAccount) {
      await db.run(
        `INSERT INTO accounts (user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT (provider, provider_account_id) DO UPDATE SET user_id = excluded.user_id, access_token = excluded.access_token, refresh_token = excluded.refresh_token`,
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
      await db.run('DELETE FROM accounts WHERE provider = ? AND provider_account_id = ?', provider, providerAccountId);
    },
    async createVerificationToken(t: VerificationToken) {
      await db.run('INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)', t.identifier.toLowerCase(), hashToken(t.token), t.expires);
      return t;
    },
    async useVerificationToken({ identifier, token }) {
      const row = await db.get<{ identifier: string; expires: Date | string }>(
        'DELETE FROM verification_tokens WHERE identifier = ? AND token = ? RETURNING identifier, expires',
        identifier.toLowerCase(),
        hashToken(token),
      );
      return row ? { identifier: row.identifier, token, expires: new Date(row.expires) } : null;
    },
  };
}

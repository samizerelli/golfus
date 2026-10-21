import type { ExpressAuthConfig } from '@auth/express';
import Apple from '@auth/express/providers/apple';
import Credentials from '@auth/express/providers/credentials';
import Google from '@auth/express/providers/google';
import Nodemailer from '@auth/express/providers/nodemailer';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { PostgresAdapter } from './adapter.ts';
import { magicLinkEmail } from './emails.ts';
import { sendMail } from './mailer.ts';
import { verifyPassword } from './password.ts';

/** Échecs de connexion par e-mail (en mémoire) : 8 essais / 15 min, puis blocage temporaire. */
const failures = new Map<string, { n: number; until: number }>();
const blocked = (email: string) => {
  const f = failures.get(email);
  return !!f && f.until > Date.now() && f.n >= 8;
};
function fail(email: string) {
  const f = failures.get(email);
  const fresh = !f || f.until < Date.now();
  failures.set(email, { n: fresh ? 1 : f!.n + 1, until: Date.now() + 15 * 60_000 });
}

/**
 * Vérifie e-mail + mot de passe (site et app iOS), avec la même protection contre les essais répétés.
 * Renvoie l'utilisateur, ou null.
 */
export async function checkCredentials(rawEmail: unknown, rawPassword: unknown) {
  const email = String(rawEmail ?? '').trim().toLowerCase();
  const password = String(rawPassword ?? '');
  if (!email || !password || blocked(email)) return null;
  const u = await db.get<{ id: string; email: string; name: string | null; password_hash: string | null }>(
    'SELECT id, email, name, password_hash FROM users WHERE email = ?',
    email,
  );
  if (!u || !(await verifyPassword(password, u.password_hash))) {
    fail(email);
    return null;
  }
  failures.delete(email);
  return { id: u.id, email: u.email, name: u.name };
}

export const authConfig: ExpressAuthConfig = {
  adapter: PostgresAdapter(),
  secret: config.authSecret || undefined,
  trustHost: true,
  basePath: '/api/auth',
  session: { strategy: 'jwt', maxAge: 30 * 24 * 3600 },
  pages: { signIn: '/connexion', verifyRequest: '/connexion?envoye=1', error: '/connexion' },
  providers: [
    // E-mail + mot de passe : fonctionne sans aucun service externe
    Credentials({
      id: 'credentials',
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const u = await checkCredentials(creds?.email, creds?.password);
        return u ? { ...u, image: null } : null;
      },
    }),
    // Lien magique : uniquement si un serveur d'envoi d'e-mails est configuré (ou en développement)
    ...(config.emailServer || !config.isProd
      ? [
          Nodemailer({
            id: 'email',
            server: config.emailServer ?? 'smtp://localhost:25',
            from: config.emailFrom,
            maxAge: 30 * 60,
            async sendVerificationRequest({ identifier, url }) {
              const u = await db.get<{ lang: string }>('SELECT lang FROM users WHERE email = ?', identifier.toLowerCase());
              const m = magicLinkEmail(u?.lang ?? 'fr', url);
              await sendMail(identifier, m.subject, m.text, m.html, url);
            },
          }),
        ]
      : []),
    ...(config.google ? [Google({ clientId: config.google.id, clientSecret: config.google.secret, allowDangerousEmailAccountLinking: true })] : []),
    ...(config.apple ? [Apple({ clientId: config.apple.id, clientSecret: config.apple.secret, allowDangerousEmailAccountLinking: true })] : []),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) {
        const row = await db.get<{ session_version: number }>('UPDATE users SET last_login_at = now() WHERE id = ? RETURNING session_version', user.id);
        token.uid = user.id;
        token.sv = row?.session_version ?? 0;
        token.method = account?.provider ?? 'unknown';
        token.authAt = Date.now();
        delete token.picture; // la photo (data URL) ne va pas dans le cookie : elle est lue via /api/me
        return token;
      }
      // À chaque lecture : le compte existe-t-il encore et la session n'a-t-elle pas été révoquée ?
      const row = await db.get<{ session_version: number }>('SELECT session_version FROM users WHERE id = ?', token.uid as string);
      if (!row || row.session_version !== token.sv) return null;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.image = null;
      }
      Object.assign(session, { method: token.method, authAt: token.authAt });
      return session;
    },
  },
};

export const authProviders = () => ({
  credentials: true,
  email: !!config.emailServer || !config.isProd,
  google: !!config.google,
  apple: !!config.apple,
});

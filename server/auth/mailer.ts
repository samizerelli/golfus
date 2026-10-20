import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.ts';
import { db } from '../db/index.ts';

let transport: Transporter | null = null;
if (config.emailServer) transport = nodemailer.createTransport(config.emailServer);

/**
 * Envoie un e-mail. Sans serveur SMTP (EMAIL_SERVER), le message est déposé dans la « boîte de développement »
 * (table dev_outbox) et le lien est affiché dans la console — uniquement hors production.
 */
export async function sendMail(to: string, subject: string, text: string, html: string, url?: string) {
  if (transport) {
    await transport.sendMail({ to, from: config.emailFrom, subject, text, html });
    return;
  }
  if (config.isProd) throw new Error('EMAIL_SERVER non configuré : impossible d’envoyer des e-mails en production');
  await db.run('INSERT INTO dev_outbox (to_email, subject, text, url) VALUES (?, ?, ?, ?)', to, subject, text, url ?? null);
  console.log(`✉️  [dev] E-mail pour ${to} : ${subject}${url ? `\n    ${url}` : ''}`);
}

/** Textes des e-mails (FR / EN / ES / DE / IT / PT / NL). */
const T: Record<string, { subject: string; intro: string; button: string; ignore: string }> = {
  fr: { subject: 'Votre lien de connexion GolfMe', intro: 'Cliquez sur le bouton pour vous connecter (lien valable 30 minutes) :', button: 'Se connecter', ignore: 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.' },
  en: { subject: 'Your GolfMe sign-in link', intro: 'Click the button to sign in (link valid for 30 minutes):', button: 'Sign in', ignore: 'If you did not request this, you can ignore this email.' },
  es: { subject: 'Tu enlace de acceso a GolfMe', intro: 'Haz clic en el botón para iniciar sesión (enlace válido 30 minutos):', button: 'Iniciar sesión', ignore: 'Si no lo has solicitado, ignora este correo.' },
  de: { subject: 'Ihr Golf-Finder-Anmeldelink', intro: 'Klicken Sie auf die Schaltfläche, um sich anzumelden (30 Minuten gültig):', button: 'Anmelden', ignore: 'Wenn Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail.' },
  it: { subject: 'Il tuo link di accesso a GolfMe', intro: 'Fai clic sul pulsante per accedere (link valido 30 minuti):', button: 'Accedi', ignore: 'Se non hai richiesto questo accesso, ignora questa e-mail.' },
  pt: { subject: 'O seu link de acesso ao GolfMe', intro: 'Clique no botão para entrar (link válido por 30 minutos):', button: 'Entrar', ignore: 'Se não fez este pedido, ignore este e-mail.' },
  nl: { subject: 'Je inloglink voor GolfMe', intro: 'Klik op de knop om in te loggen (link 30 minuten geldig):', button: 'Inloggen', ignore: 'Heb je dit niet aangevraagd? Negeer dan deze e-mail.' },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function magicLinkEmail(lang: string, url: string) {
  const t = T[lang] ?? T.fr;
  return {
    subject: t.subject,
    text: `${t.intro}\n${url}\n\n${t.ignore}`,
    html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f1a24">
<h1 style="font-size:20px">⛳ GolfMe</h1><p>${esc(t.intro)}</p>
<p><a href="${esc(url)}" style="display:inline-block;background:#1f5d4a;color:#fff;padding:12px 20px;border-radius:14px;text-decoration:none;font-weight:600">${esc(t.button)}</a></p>
<p style="color:#5b6670;font-size:13px">${esc(t.ignore)}</p></div>`,
  };
}

/**
 * Filtre des contenus publiés par les utilisateurs (règle App Store 1.2) : prénoms, avis, messages d'invitation.
 * Volontairement simple : insultes et termes haineux courants (FR, EN, ES), y compris écrits avec des chiffres
 * ou des accents (« s4l0pe »), et liens dans les avis (spam). Le reste passe par le signalement et la modération.
 */

// Mots entiers, avec leurs pluriels et féminins (suffixes ci-dessous). Les mots ambigus sont exclus
// (« retard », « negro » = noir en espagnol, « cono », « tapette »…) pour ne pas bloquer de textes normaux.
const ROOTS = [
  // français
  'connard', 'connasse', 'salope', 'salaud', 'encule', 'enculé', 'pute', 'putain', 'batard', 'bâtard', 'pd', 'pédé',
  'bougnoul', 'youpin', 'nique ta', 'ntm', 'fdp', 'fils de pute', 'sale arabe', 'sale noir', 'sale juif',
  // anglais
  'fuck', 'motherfuck', 'bitch', 'cunt', 'whore', 'slut', 'faggot', 'fag', 'nigger', 'nigga', 'kike', 'spic', 'dickhead', 'asshole',
  // espagnol
  'puta', 'puto', 'gilipollas', 'cabron', 'cabrón', 'maricon', 'maricón', 'hijo de puta', 'mierda', 'pendejo', 'sudaca',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '€': 'e' };

export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[013457@$€]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PATTERNS = [...new Set(ROOTS.map(normalize))].map((r) => new RegExp(`(^| )${r.replace(/ /g, ' ?')}(s|e|es|x|a|as|o|os|er|ers|ing|ed)?( |$)`));

/** Vrai si le texte contient un terme injurieux ou haineux de la liste. */
export function isObjectionable(text: string | null | undefined) {
  if (!text) return false;
  const n = normalize(text);
  return PATTERNS.some((p) => p.test(n));
}

export const hasLink = (text: string) => /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|info|ru|xyz|top|io|ch|fr|es)\b)/i.test(text);

/** Pour zod : `.refine(clean, { message: 'inappropriate' })` */
export const clean = (text: string | null | undefined) => !isObjectionable(text);

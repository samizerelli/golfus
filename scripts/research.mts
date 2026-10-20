/**
 * Outil de relevé (usage admin, hors production) : télécharge les pages utiles du site officiel d'un golf
 * (accueil, tarifs, horaires, contact, réservation) en respectant robots.txt, et enregistre leur texte brut
 * pour une relecture humaine. Aucune donnée n'est publiée automatiquement.
 * Usage : tsx scripts/research.mts <dossier-sortie> < liste (id|nom|site par ligne)
 */
import { writeFileSync } from 'node:fs';
import { fetchText } from '../server/lib/fetchText.ts';
import { robotsAllows } from '../server/lib/robots.ts';

const out = process.argv[2];
const KEY = /(tarif|precio|rate|price|green[-_ ]?fee|fees|reserv|booking|book-|tee-?time|horario|opening|hours|contact|visitor|visitante|jugar|play)/i;
const ENGINES = /(golfmanager|teeone|imaster|chronogolf|golfnow|teetimes|deemples|tee-?booking|golf-?online|clubmanager|mygolf|bookingengine|reservas\.|booking\.)/i;

const text = (html: string) =>
  html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|td|th|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

const lines = (await new Response(process.stdin as unknown as ReadableStream).text()).trim().split('\n');
for (const line of lines) {
  const [id, name, site] = line.split('|').map((s) => s.trim());
  if (!site || site === 'None') continue;
  let report = `# ${name} (${id})\nSITE ${site}\n`;
  const seen = new Set<string>();
  const queue: string[] = [site];
  let pages = 0;
  while (queue.length && pages < 7) {
    const url = queue.shift()!;
    const key = url.replace(/[#?].*$/, '').replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const u = new URL(url);
      if (!(await robotsAllows(u))) {
        report += `\n## ${url}\n(robots.txt : interdit)\n`;
        continue;
      }
      const { body, finalUrl } = await fetchText(url, { timeoutMs: 9000 });
      pages++;
      report += `\n## PAGE ${finalUrl}\n${text(body).slice(0, 12000)}\n`;
      const links = [...body.matchAll(/href="([^"#]+)"/gi)].map((m) => {
        try {
          return new URL(m[1].replace(/&amp;/g, '&'), finalUrl).href;
        } catch {
          return null;
        }
      });
      for (const l of links) {
        if (!l) continue;
        if (ENGINES.test(l)) report += `ENGINE ${l}\n`;
        const same = new URL(l).hostname.replace(/^www\./, '') === new URL(finalUrl).hostname.replace(/^www\./, '');
        if (same && KEY.test(new URL(l).pathname) && !/\.(pdf|jpe?g|png|webp)$/i.test(l) && queue.length < 12) queue.push(l);
        if (/\.pdf$/i.test(l) && /(tarif|precio|rate|price|fee)/i.test(l)) report += `PDF ${l}\n`;
      }
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      report += `\n## ${url}\nERREUR ${(e as Error).message}\n`;
    }
  }
  writeFileSync(`${out}/${id}.txt`, report);
  console.log(`${name}: ${pages} pages`);
}

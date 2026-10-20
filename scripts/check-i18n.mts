/**
 * Vérifie les traductions : mêmes clés dans les 3 langues, mêmes variables {x} dans chaque phrase,
 * et aucune clé utilisée dans le code qui manquerait.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../src/i18n/en.ts';
import { es } from '../src/i18n/es.ts';
import { fr } from '../src/i18n/fr.ts';

const langs: Record<string, Record<string, string>> = { fr, en, es };
let errors = 0;
const fail = (m: string) => (errors++, console.error(`✗ ${m}`));
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

for (const [l, dict] of Object.entries(langs)) {
  for (const k of Object.keys(fr)) if (!(k in dict)) fail(`${l} : clé manquante « ${k} »`);
  for (const k of Object.keys(dict)) {
    if (!(k in fr)) fail(`${l} : clé inconnue en français « ${k} »`);
    else if (vars(dict[k]) !== vars(fr[k])) fail(`${l} : variables différentes pour « ${k} » (${vars(dict[k])} ≠ ${vars(fr[k])})`);
  }
}

// Clés écrites en clair dans le code : t('…') / tp('…')
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.tsx?$/.test(f) ? [join(d, f)] : []));
for (const file of walk('src').filter((f) => !f.includes('/i18n/'))) {
  for (const m of readFileSync(file, 'utf8').matchAll(/\btp?\(\s*'([\w.]+)'/g)) {
    const k = m[1];
    if (!(k in fr) && !(`${k}_one` in fr)) fail(`${file} : clé absente « ${k} »`);
  }
}
console.log(errors ? `${errors} erreur(s)` : `✓ traductions cohérentes (${Object.keys(fr).length} clés × 3 langues)`);
process.exit(errors ? 1 : 0);

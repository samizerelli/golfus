/** Vérifie les fiches relevées : horaires valides, formats de dates et d'heures, montants plausibles. */
import { CURATED_GOLFS } from '../server/db/curatedData.ts';
import { isValidOpeningHours } from '../server/lib/validate.ts';

let errors = 0;
const fail = (id: string, m: string) => (errors++, console.error(`✗ ${id} : ${m}`));
for (const g of CURATED_GOLFS) {
  if (g.openingHours && !isValidOpeningHours(g.openingHours)) fail(g.id, `horaires invalides « ${g.openingHours} »`);
  for (const p of g.prices ?? []) {
    if (!(p.amount > 0 && p.amount < 1000)) fail(g.id, `montant ${p.amount}`);
    for (const d of [p.fromDate, p.toDate]) if (d && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)) fail(g.id, `date ${d}`);
    for (const t of [p.fromTime, p.toTime]) if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) fail(g.id, `heure ${t}`);
  }
}
console.log(errors ? `${errors} erreur(s)` : `✓ ${CURATED_GOLFS.length} fiches valides`);
process.exit(errors ? 1 : 0);

import { fetchText } from './fetchText.ts';

const cache = new Map<string, { rules: { allow: boolean; path: string }[]; at: number }>();

/** Analyse simple de robots.txt : groupes « User-agent: * » ou « GolfUs », règle Allow/Disallow la plus longue. */
export function parseRobots(txt: string, agent = 'golfus') {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^(user-agent|allow|disallow)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if (cur) {
      lastWasAgent = false;
      if (val) cur.rules.push({ allow: key === 'allow', path: val });
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

export function isAllowed(rules: { allow: boolean; path: string }[], pathname: string) {
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules) {
    const pattern = r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
    if (new RegExp(`^${pattern}`).test(pathname) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow)))
      best = { allow: r.allow, len: r.path.length };
  }
  return best ? best.allow : true;
}

/** robots.txt d'un site (mis en cache 24 h en mémoire). En cas d'absence ou d'erreur 4xx : tout est autorisé. */
export async function robotsAllows(url: URL) {
  const origin = url.origin;
  let entry = cache.get(origin);
  if (!entry || Date.now() - entry.at > 24 * 3600_000) {
    const txt = await fetchText(`${origin}/robots.txt`, { timeoutMs: 3000, maxBytes: 200_000, acceptAny: true }).catch(() => null);
    entry = { rules: txt ? parseRobots(txt.body) : [], at: Date.now() };
    cache.set(origin, entry);
  }
  return isAllowed(entry.rules, url.pathname);
}

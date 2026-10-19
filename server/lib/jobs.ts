/** Tâches périodiques en mémoire (un seul processus). */
const jobs: { name: string; everyMs: number; fn: () => Promise<void> | void; last: number }[] = [];

export function schedule(name: string, everyMs: number, fn: () => Promise<void> | void) {
  jobs.push({ name, everyMs, fn, last: 0 });
}

export function startJobs() {
  const tick = async () => {
    const now = Date.now();
    for (const j of jobs) {
      if (now - j.last < j.everyMs) continue;
      j.last = now;
      try {
        await j.fn();
      } catch (e) {
        console.error(`[job ${j.name}]`, (e as Error).message);
      }
    }
  };
  setInterval(tick, 30_000).unref();
  setTimeout(tick, 5_000).unref();
}

/** File d'attente garantissant un intervalle minimal entre deux appels (ex. Nominatim : 1 req/s). */
export function throttle(minIntervalMs: number) {
  let last = 0;
  let chain: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(async () => {
      const wait = last + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      last = Date.now();
      return fn();
    });
    chain = run.catch(() => undefined);
    return run;
  };
}

export const nominatimQueue = throttle(1100);

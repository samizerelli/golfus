/** Squelette affiché pendant le chargement d'une page (formes neutres, annoncé aux lecteurs d'écran). */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="skeleton aspect-[16/9] w-full rounded-[28px]" aria-hidden />
      <div className="skeleton h-8 w-2/3 rounded-full" aria-hidden />
      <div className="skeleton h-4 w-1/2 rounded-full" aria-hidden />
      <div className="skeleton h-32 w-full rounded-[24px]" aria-hidden />
    </div>
  );
}

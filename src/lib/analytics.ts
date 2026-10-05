type PlausibleFn = (event: string, options?: { props?: Record<string, string | number> }) => void;

/** Evento de analítica sin cookies (Plausible). No hace nada si Plausible no está cargado. */
export function trackEvent(event: string, props?: Record<string, string | number>) {
  const w = window as unknown as { plausible?: PlausibleFn };
  try {
    w.plausible?.(event, props ? { props } : undefined);
  } catch {
    /* la analítica nunca debe romper la herramienta */
  }
}

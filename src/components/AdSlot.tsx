"use client";

import { useEffect, useRef } from "react";
import { useConsent } from "./consent";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
const SLOTS = {
  inline: process.env.NEXT_PUBLIC_ADSENSE_SLOT_INLINE ?? "",
  article: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE ?? "",
};

/**
 * Hueco de anuncio. Regla de colocación: nunca encima del mapa ni de los resultados,
 * solo entre bloques de contenido editorial. No pinta nada hasta que hay cliente,
 * bloque configurado y consentimiento.
 */
export function AdSlot({ slot, className = "" }: { slot: keyof typeof SLOTS; className?: string }) {
  const { adsAllowed } = useConsent();
  const pushed = useRef(false);
  const slotId = SLOTS[slot];
  const active = adsAllowed && Boolean(slotId);

  useEffect(() => {
    if (!active || pushed.current) return;
    pushed.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      /* un bloqueador de anuncios no debe romper la página */
    }
  }, [active]);

  if (!active) return null;
  return (
    <aside className={`my-8 ${className}`} aria-label="Publicidad">
      <p className="mb-1 text-center text-[11px] uppercase tracking-wider text-ink-3">Publicidad</p>
      <ins
        className="adsbygoogle block min-h-[100px]"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

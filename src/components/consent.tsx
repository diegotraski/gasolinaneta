"use client";

import Link from "next/link";
import Script from "next/script";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Consentimiento de cookies (RGPD/LSSI) y carga condicionada de terceros.
 *
 * - Plausible no usa cookies → se carga siempre (si está configurado).
 * - Google Analytics y AdSense → solo tras consentimiento, con Google Consent Mode v2 en "denied" por defecto.
 * - Si NEXT_PUBLIC_USE_GOOGLE_CMP=true, el CMP certificado de Google (configurado en AdSense →
 *   Privacidad y mensajes) gestiona el consentimiento de los anuncios y este banner solo cubre la analítica.
 */

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
const USE_GOOGLE_CMP = process.env.NEXT_PUBLIC_USE_GOOGLE_CMP === "true";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? "";

const ADS_NEED_OUR_CONSENT = Boolean(ADSENSE_CLIENT) && !USE_GOOGLE_CMP;
const ANALYTICS_NEEDS_CONSENT = Boolean(GA_ID);
/** Sin terceros que pongan cookies no hay nada que consentir y no molestamos con un banner. */
export const CONSENT_BANNER_ENABLED = ADS_NEED_OUR_CONSENT || ANALYTICS_NEEDS_CONSENT;
/** Hace falta el snippet de Consent Mode en <head> si se va a cargar cualquier script de Google. */
export const GOOGLE_TAGS_CONFIGURED = Boolean(ADSENSE_CLIENT || GA_ID);

const STORAGE_KEY = "gn-consent-v1";

interface Consent {
  ads: boolean;
  analytics: boolean;
  decidedAt: string;
}

interface ConsentContextValue {
  consent: Consent | null;
  /** true cuando los anuncios pueden cargarse (consentimiento propio o CMP de Google). */
  adsAllowed: boolean;
  openSettings: () => void;
}

const ConsentContext = createContext<ConsentContextValue>({ consent: null, adsAllowed: false, openSettings: () => {} });
export const useConsent = () => useContext(ConsentContext);

function readStored(): Consent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch {
    return null;
  }
}

function gtagConsentUpdate(params: Record<string, string>) {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("consent", "update", params);
}

/** Va en <head>: deniega todo por defecto antes de que cargue cualquier script de Google. */
export const CONSENT_DEFAULT_SNIPPET = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});`;

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    // localStorage solo existe en el cliente: se lee tras hidratar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(readStored());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!consent || !GOOGLE_TAGS_CONFIGURED) return;
    const params: Record<string, string> = { analytics_storage: consent.analytics ? "granted" : "denied" };
    // Con el CMP de Google, es él quien actualiza las señales de anuncios.
    if (!USE_GOOGLE_CMP) {
      const ads = consent.ads ? "granted" : "denied";
      Object.assign(params, { ad_storage: ads, ad_user_data: ads, ad_personalization: ads });
    }
    gtagConsentUpdate(params);
  }, [consent]);

  const save = useCallback(
    (next: Omit<Consent, "decidedAt">) => {
      const value = { ...next, decidedAt: new Date().toISOString() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        /* modo privado: el consentimiento vale solo para esta visita */
      }
      // Retirar un consentimiento ya dado exige descargar los scripts: recargamos.
      const revoked = consent && ((consent.ads && !next.ads) || (consent.analytics && !next.analytics));
      setConsent(value);
      setSettingsOpen(false);
      if (revoked) window.location.reload();
    },
    [consent],
  );

  const adsAllowed = Boolean(ADSENSE_CLIENT) && (USE_GOOGLE_CMP || Boolean(consent?.ads));
  const showBanner = CONSENT_BANNER_ENABLED && loaded && (consent === null || settingsOpen);

  return (
    <ConsentContext.Provider value={{ consent, adsAllowed, openSettings: () => setSettingsOpen(true) }}>
      {children}
      <ThirdPartyScripts adsAllowed={adsAllowed} analyticsAllowed={Boolean(consent?.analytics)} />
      {showBanner && (
        <CookieBanner key={String(settingsOpen)} initial={consent} onSave={save} startExpanded={settingsOpen} />
      )}
    </ConsentContext.Provider>
  );
}

function ThirdPartyScripts({ adsAllowed, analyticsAllowed }: { adsAllowed: boolean; analyticsAllowed: boolean }) {
  return (
    <>
      {PLAUSIBLE_DOMAIN && (
        <>
          <Script id="plausible-queue" strategy="afterInteractive">
            {"window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}"}
          </Script>
          <Script src="https://plausible.io/js/script.js" data-domain={PLAUSIBLE_DOMAIN} strategy="afterInteractive" />
        </>
      )}
      {GA_ID && analyticsAllowed && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-config" strategy="afterInteractive">
            {`gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      {adsAllowed && (
        <Script
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}
    </>
  );
}

function CookieBanner({
  initial,
  onSave,
  startExpanded,
}: {
  initial: Consent | null;
  onSave: (c: Omit<Consent, "decidedAt">) => void;
  startExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(startExpanded);
  const [ads, setAds] = useState(initial?.ads ?? false);
  const [analytics, setAnalytics] = useState(initial?.analytics ?? false);
  const secondary = "flex-1 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface-2";

  return (
    <div
      role="dialog"
      aria-label="Preferencias de cookies"
      className="fixed inset-x-0 bottom-0 z-[1100] border-t border-line bg-surface p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-md sm:rounded-2xl sm:border"
    >
      <p className="text-sm font-semibold">Tu privacidad</p>
      <p className="mt-1 text-sm text-ink-2">
        Usamos almacenamiento propio necesario y, solo si lo aceptas,
        {ADS_NEED_OUR_CONSENT && " cookies de Google AdSense para mostrar anuncios"}
        {ADS_NEED_OUR_CONSENT && ANALYTICS_NEEDS_CONSENT && " y"}
        {ANALYTICS_NEEDS_CONSENT && " cookies de analítica para saber cómo se usa la web"}. Más información en la{" "}
        <Link href="/cookies" className="underline">
          política de cookies
        </Link>
        .
      </p>

      {expanded && (
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2 text-ink-3">
            <input type="checkbox" checked disabled /> Necesarias (siempre activas)
          </label>
          {ADS_NEED_OUR_CONSENT && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={ads} onChange={(e) => setAds(e.target.checked)} /> Publicidad (Google
              AdSense)
            </label>
          )}
          {ANALYTICS_NEEDS_CONSENT && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /> Analítica
              (Google Analytics)
            </label>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {/* Rechazar con el mismo peso visual que aceptar, como pide la guía de cookies de la AEPD. */}
        <button onClick={() => onSave({ ads: false, analytics: false })} className={secondary}>
          Rechazar
        </button>
        {expanded ? (
          <button onClick={() => onSave({ ads, analytics })} className={secondary}>
            Guardar selección
          </button>
        ) : (
          <button onClick={() => setExpanded(true)} className={secondary}>
            Configurar
          </button>
        )}
        <button
          onClick={() => onSave({ ads: ADS_NEED_OUR_CONSENT, analytics: ANALYTICS_NEEDS_CONSENT })}
          className="flex-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-ink"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}

export function CookieSettingsLink() {
  const { openSettings } = useConsent();
  if (!CONSENT_BANNER_ENABLED) return null;
  return (
    <button onClick={openSettings} className="hover:text-ink">
      Preferencias de cookies
    </button>
  );
}

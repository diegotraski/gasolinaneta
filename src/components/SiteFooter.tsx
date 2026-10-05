import Link from "next/link";
import { CookieSettingsLink } from "./consent";
import { Logo } from "./SiteHeader";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-ink-2 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm">
            Compara gasolineras por lo que de verdad ahorras, descontando el combustible que gastas en llegar.
          </p>
          <p className="mt-3 max-w-sm text-xs text-ink-3">
            Precios: Geoportal de Gasolineras del Gobierno de España (Ministerio para la Transición Ecológica y el Reto
            Demográfico), reutilizados según la Ley 37/2007. Mapa: © colaboradores de OpenStreetMap. Las cifras son
            estimaciones orientativas.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-medium text-ink">Herramienta</p>
          <Link href="/#calculadora" className="hover:text-ink">
            Calculadora de ahorro neto
          </Link>
          <Link href="/como-funciona" className="hover:text-ink">
            Cómo calculamos
          </Link>
          <Link href="/blog" className="hover:text-ink">
            Blog
          </Link>
        </div>
        <div className="flex flex-col items-start gap-2">
          <p className="font-medium text-ink">Legal</p>
          <Link href="/aviso-legal" className="hover:text-ink">
            Aviso legal
          </Link>
          <Link href="/privacidad" className="hover:text-ink">
            Privacidad
          </Link>
          <Link href="/cookies" className="hover:text-ink">
            Cookies
          </Link>
          <CookieSettingsLink />
        </div>
      </div>
    </footer>
  );
}

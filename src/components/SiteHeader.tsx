import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--brand)" />
        <path
          d="M11 8h7a2 2 0 0 1 2 2v14h-11V10a2 2 0 0 1 2-2Zm1 3v4h6v-4h-6Zm8 3h2.2a1.8 1.8 0 0 1 1.8 1.8v4.7a1 1 0 0 0 2 0v-7.3l-2.4-2.4"
          fill="none"
          stroke="var(--brand-ink)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        Gasolina<span className="text-brand">Neta</span>
      </span>
      <span className="sr-only">{SITE_NAME}</span>
    </span>
  );
}

const NAV = [
  { href: "/#calculadora", label: "Calculadora", mobile: false },
  { href: "/como-funciona", label: "Cómo funciona", mobile: true },
  { href: "/blog", label: "Blog", mobile: true },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-[1001] border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label={`${SITE_NAME}, inicio`}>
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-md px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink sm:px-2.5 ${item.mobile ? "" : "hidden sm:block"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

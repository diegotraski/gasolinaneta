const eurFmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const priceFmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const kmFmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const eur = (n: number) => eurFmt.format(Math.abs(n) < 0.005 ? 0 : n);
/** Con signo explícito: "+7,19 €" / "−1,45 €". */
export const signedEur = (n: number) => (Math.abs(n) < 0.005 ? eur(0) : `${n > 0 ? "+" : "−"}${eurFmt.format(Math.abs(n))}`);
export const pricePerLiter = (n: number) => `${priceFmt.format(n)} €/l`;
export const km = (n: number) => `${kmFmt.format(n)} km`;

/** "Fulano Gasolineras S.L." → "Fulano Gasolineras S.L.", "REPSOL" → "Repsol". */
export function prettyName(raw: string): string {
  if (raw !== raw.toUpperCase()) return raw;
  return raw.toLowerCase().replace(/(^|[\s\-/(.'"])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

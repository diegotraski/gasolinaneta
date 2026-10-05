import type { Verdict } from "@/lib/netSavings";

/** Leaflet escribe los colores como atributos SVG, donde var(--x) no funciona: van en hexadecimal. */
export const VERDICT_COLOR: Record<Verdict, string> = {
  reference: "#2563eb",
  worth: "#16a34a",
  marginal: "#d99a06",
  notWorth: "#d9463b",
};

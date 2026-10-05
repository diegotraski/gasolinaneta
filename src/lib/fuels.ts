/** Combustibles que ofrece la herramienta y su campo en la API del Ministerio. */
export const FUELS = {
  g95: { label: "Gasolina 95", apiField: "Precio Gasolina 95 E5" },
  g98: { label: "Gasolina 98", apiField: "Precio Gasolina 98 E5" },
  diesel: { label: "Diésel", apiField: "Precio Gasoleo A" },
  dieselPlus: { label: "Diésel+", apiField: "Precio Gasoleo Premium" },
} as const;

export type FuelId = keyof typeof FUELS;
export const FUEL_IDS = Object.keys(FUELS) as FuelId[];

export function isFuelId(value: unknown): value is FuelId {
  return typeof value === "string" && value in FUELS;
}

/** Consumos orientativos (l/100 km). Son valores redondos de referencia, no datos homologados. */
export const CONSUMPTION_PRESETS = [
  { id: "gas-small", label: "Gasolina, coche pequeño", value: 5.5 },
  { id: "gas-big", label: "Gasolina, coche grande/SUV", value: 8 },
  { id: "diesel-small", label: "Diésel, coche pequeño", value: 4.5 },
  { id: "diesel-big", label: "Diésel, coche grande/SUV", value: 6.5 },
] as const;

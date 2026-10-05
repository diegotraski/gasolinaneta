/**
 * Fase 0: valida la fórmula con datos reales antes de fiarse de la interfaz.
 *
 *   npx tsx scripts/fase0.ts                       # descarga de la API y usa los puntos de ejemplo
 *   npx tsx scripts/fase0.ts --file api.json       # usa una descarga guardada
 *   npx tsx scripts/fase0.ts --at 40.4168,-3.7038  # tu propia ubicación (repetible)
 *
 * Opciones: --fuel g95|g98|diesel|dieselPlus  --liters 40  --consumption 6  --radius 15
 */
import { readFileSync } from "node:fs";
import { isFuelId } from "../src/lib/fuels";
import { fetchMinistrySnapshot, normalizeResponse, type RawResponse } from "../src/lib/ministry";
import { computeNetSavings } from "../src/lib/netSavings";
import { findNearby } from "../src/lib/nearby";

const DEFAULT_POINTS: [string, number, number][] = [
  ["Madrid, Puerta del Sol", 40.4169, -3.7035],
  ["Barcelona, Pl. Catalunya", 41.387, 2.17],
  ["Valencia, Ayuntamiento", 39.4699, -0.3763],
  ["Sevilla, Catedral", 37.3858, -5.9931],
  ["Zaragoza, El Pilar", 41.6566, -0.8784],
  ["Albacete (interior)", 38.9943, -1.8585],
];

function arg(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => a === `--${name}` && process.argv[i + 1] && out.push(process.argv[i + 1]));
  return out;
}

const eur = (n: number) => `${n >= 0 ? " " : ""}${n.toFixed(2)} €`;

async function main() {
  const file = arg("file")[0];
  const snapshot = file
    ? normalizeResponse(JSON.parse(readFileSync(file, "utf8")) as RawResponse)
    : await fetchMinistrySnapshot();
  const fuel = arg("fuel")[0] ?? "g95";
  if (!isFuelId(fuel)) throw new Error(`Combustible desconocido: ${fuel}`);
  const liters = Number(arg("liters")[0] ?? 40);
  const consumption = Number(arg("consumption")[0] ?? 6);
  const radius = Number(arg("radius")[0] ?? 15);
  const points = arg("at").length
    ? arg("at").map((p, i) => [`Punto ${i + 1}`, ...p.split(",").map(Number)] as [string, number, number])
    : DEFAULT_POINTS;

  console.log(`Datos del Ministerio: ${snapshot.ministryDate} · ${snapshot.stations.length} estaciones`);
  console.log(`Combustible ${fuel} · ${liters} l · ${consumption} l/100km · radio ${radius} km · viaje dedicado\n`);

  let differs = 0;
  for (const [name, lat, lon] of points) {
    const near = findNearby(snapshot.stations, lat, lon, fuel, radius);
    const r = computeNetSavings(near, { liters, consumptionL100: consumption, mode: "dedicated" });
    if (!r) {
      console.log(`${name}: sin gasolineras en ${radius} km\n`);
      continue;
    }
    const label = (id: string) => {
      const s = near.find((x) => x.id === id)!;
      return `${s.brand} (${s.town})`;
    };
    const line = (tag: string, b: typeof r.reference) =>
      `  ${tag.padEnd(12)} ${b.price.toFixed(3)} €/l  ${b.roadKm.toFixed(1).padStart(5)} km  ` +
      `ahorro ${eur(b.grossSaving)}  desplaz. ${b.extraKm.toFixed(1)} km = ${eur(-b.travelCost)}  NETO ${eur(b.netSaving)}  ${label(b.id)}`;
    console.log(`${name} — ${near.length} gasolineras`);
    console.log(line("Referencia", r.reference));
    console.log(line("Más barata", r.cheapest));
    console.log(line("Más ahorra", r.best));
    console.log(`  ¿Difieren la más barata y la que más ahorra? ${r.cheapestIsNotBest ? "SÍ" : "no"}\n`);
    if (r.cheapestIsNotBest) differs++;
  }
  console.log(`Casos en que la más barata no es la que más ahorra: ${differs}/${points.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import "server-only";
import { NAP_EV_URL, parseDatex } from "./ev/datex";
import type { EvSite } from "./ev/types";
import { fetchMinistrySnapshot } from "./ministry";
import { createSnapshotStore } from "./snapshotStore";
import type { Snapshot, Station } from "./types";

// ---------- Precios de carburantes (Ministerio) ----------
// El Ministerio publica precios nuevos cada media hora: a los 30 min descargamos en segundo plano.
const fuelStore = createSnapshotStore<Station>({
  table: "fuel_snapshots",
  download: async () => {
    const s = await fetchMinistrySnapshot();
    return { sourceDate: s.ministryDate, items: s.stations };
  },
  softStaleMs: 30 * 60 * 1000,
  hardStaleMs: 6 * 60 * 60 * 1000,
});

const toFuel = (s: { sourceDate: string; fetchedAt: string; items: Station[] }): Snapshot => ({
  ministryDate: s.sourceDate,
  fetchedAt: s.fetchedAt,
  stations: s.items,
});

export const getSnapshot = async () => toFuel(await fuelStore.get());
export const refreshSnapshot = async () => toFuel(await fuelStore.refresh());

// ---------- Puntos de recarga eléctrica (NAP de la DGT) ----------
// El fichero (~83 MB) se regenera a diario: no tiene sentido descargarlo más de unas pocas veces al día.
const EV_SOFT_STALE_MS = 6 * 60 * 60 * 1000;

const evStore = createSnapshotStore<EvSite>({
  table: "ev_snapshots",
  download: async () => {
    const res = await fetch(NAP_EV_URL, { cache: "no-store", signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`NAP DGT respondió ${res.status}`);
    const { publicationTime, sites } = parseDatex(await res.text());
    return { sourceDate: publicationTime, items: sites };
  },
  softStaleMs: EV_SOFT_STALE_MS,
  hardStaleMs: 7 * 24 * 60 * 60 * 1000,
  memoryTtlMs: 30 * 60 * 1000,
});

export const getEvSnapshot = () => evStore.get();

/** Para el cron: el NAP solo cambia a diario, así que solo lo descargamos si lo que tenemos ya es viejo. */
export async function refreshEvIfStale() {
  if ((await evStore.age()) < EV_SOFT_STALE_MS) return null;
  return evStore.refresh();
}

import "server-only";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Caché genérica de un dataset público (precios de carburantes, puntos de recarga…) en tres niveles:
 *   1. Memoria del proceso (se reutiliza entre peticiones mientras la función siga "caliente").
 *   2. Supabase (una tabla por dataset), escrita por el cron. Es la fuente de verdad en producción.
 *   3. Fichero local, para desarrollo sin Supabase.
 * El navegador del usuario NUNCA llama a las fuentes oficiales.
 */

export interface GenericSnapshot<T> {
  /** Fecha que declara la propia fuente (texto, tal cual). */
  sourceDate: string;
  /** Momento en que nuestro servidor descargó los datos (ISO). */
  fetchedAt: string;
  items: T[];
}

interface StoreOptions<T> {
  /** Nombre de la tabla en Supabase y del fichero local. */
  table: string;
  download: () => Promise<{ sourceDate: string; items: T[] }>;
  /** Pasada esta edad servimos lo que hay y descargamos en segundo plano. */
  softStaleMs: number;
  /** Pasada esta edad no servimos datos sin antes intentar refrescarlos. */
  hardStaleMs: number;
  /** Cada cuánto vuelve un proceso a mirar Supabase (por si otro proceso o el cron ya refrescó). */
  memoryTtlMs?: number;
}

const SNAPSHOTS_TO_KEEP = 3;
/** Si una descarga falla, no lo reintentamos en cada petición. */
const RETRY_AFTER_FAILURE_MS = 2 * 60 * 1000;

function supabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  // La integración Supabase de Vercel crea ambas; la "secret key" es el formato nuevo de Supabase.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function createSnapshotStore<T>(opts: StoreOptions<T>) {
  const { table, download, softStaleMs, hardStaleMs, memoryTtlMs = 3 * 60 * 1000 } = opts;
  let memory: { snapshot: GenericSnapshot<T>; loadedAt: number } | null = null;
  let inflight: Promise<GenericSnapshot<T>> | null = null;
  let refreshing: Promise<GenericSnapshot<T>> | null = null;
  let lastRefreshAttempt = 0;

  const localFile = () =>
    // En Vercel solo /tmp es escribible; en local dejamos el fichero junto al proyecto.
    path.join(process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), ".cache"), `${table}.json`);
  const ageMs = (s: GenericSnapshot<T>) => Date.now() - new Date(s.fetchedAt).getTime();

  async function readPersisted(): Promise<GenericSnapshot<T> | null> {
    const db = supabase();
    if (db) {
      // Primero solo la fecha (unos bytes): si ya tenemos esa foto en memoria, no volvemos a bajar 3-5 MB.
      // Sin esto, cada proceso del servidor gastaría GB al mes del tráfico de Supabase.
      const head = await db.from(table).select("fetched_at").order("fetched_at", { ascending: false }).limit(1).maybeSingle();
      if (head.error) throw new Error(`Supabase ${table}: ${head.error.message}`);
      if (!head.data) return null;
      if (memory && new Date(memory.snapshot.fetchedAt).getTime() === new Date(head.data.fetched_at).getTime()) {
        return memory.snapshot;
      }
      const { data, error } = await db
        .from(table)
        .select("source_date, fetched_at, items")
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Supabase ${table}: ${error.message}`);
      if (data) return { sourceDate: data.source_date, fetchedAt: data.fetched_at, items: data.items };
    }
    try {
      return JSON.parse(await fs.readFile(localFile(), "utf8")) as GenericSnapshot<T>;
    } catch {
      return null;
    }
  }

  async function persist(snapshot: GenericSnapshot<T>): Promise<void> {
    const db = supabase();
    if (db) {
      const { error } = await db.from(table).insert({
        source_date: snapshot.sourceDate,
        fetched_at: snapshot.fetchedAt,
        item_count: snapshot.items.length,
        items: snapshot.items,
      });
      if (error) throw new Error(`Supabase ${table}: ${error.message}`);
      // Guardamos solo las últimas copias: el histórico queda fuera del MVP.
      const { data: old } = await db
        .from(table)
        .select("id")
        .order("fetched_at", { ascending: false })
        .range(SNAPSHOTS_TO_KEEP, SNAPSHOTS_TO_KEEP + 50);
      if (old?.length) await db.from(table).delete().in("id", old.map((r) => r.id));
      return;
    }
    const file = localFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(snapshot));
  }

  /** Descarga de la fuente oficial y guarda. Las llamadas simultáneas comparten la misma descarga. */
  function refresh(): Promise<GenericSnapshot<T>> {
    refreshing ??= (async () => {
      const { sourceDate, items } = await download();
      const snapshot = { sourceDate, fetchedAt: new Date().toISOString(), items };
      await persist(snapshot);
      memory = { snapshot, loadedAt: Date.now() };
      return snapshot;
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  function refreshInBackground() {
    if (refreshing || Date.now() - lastRefreshAttempt < RETRY_AFTER_FAILURE_MS) return;
    lastRefreshAttempt = Date.now();
    after(() => refresh().catch((err) => console.error(`[${table}] refresco en segundo plano fallido`, err)));
  }

  async function load(): Promise<GenericSnapshot<T>> {
    const persisted = await readPersisted().catch((err) => {
      console.error(`[${table}] no se pudo leer la caché persistida`, err);
      return null;
    });
    if (persisted && ageMs(persisted) < softStaleMs) return persisted;
    if (persisted && ageMs(persisted) < hardStaleMs) {
      refreshInBackground();
      return persisted;
    }
    try {
      return await refresh();
    } catch (err) {
      // Mejor servir datos viejos (la interfaz muestra su fecha) que nada.
      if (persisted) {
        console.error(`[${table}] refresco fallido, sirviendo datos antiguos`, err);
        return persisted;
      }
      throw err;
    }
  }

  async function get(): Promise<GenericSnapshot<T>> {
    if (memory && Date.now() - memory.loadedAt < memoryTtlMs) {
      // Aunque la copia en memoria sea reciente de leer, sus datos pueden ser viejos.
      if (ageMs(memory.snapshot) >= softStaleMs) refreshInBackground();
      return memory.snapshot;
    }
    inflight ??= load()
      .then((snapshot) => {
        memory = { snapshot, loadedAt: Date.now() };
        return snapshot;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  /** Edad de los datos que tenemos (sin descargar nada). */
  async function age(): Promise<number> {
    const s = memory?.snapshot ?? (await readPersisted().catch(() => null));
    return s ? ageMs(s) : Infinity;
  }

  return { get, refresh, age };
}

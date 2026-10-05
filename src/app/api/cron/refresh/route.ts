import { refreshEvIfStale, refreshSnapshot } from "@/lib/store";

// Descargar ~12 MB (carburantes) y, a veces, ~83 MB (recarga) puede tardar más que el límite por defecto.
export const maxDuration = 120;

/**
 * Lo invocan Vercel Cron y GitHub Actions (ver vercel.json y .github/workflows), con "Authorization: Bearer $CRON_SECRET".
 * Carburantes: siempre. Puntos de recarga: solo si lo que tenemos tiene más de 6 h (el NAP cambia a diario).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const started = Date.now();
  const [fuel, ev] = await Promise.allSettled([refreshSnapshot(), refreshEvIfStale()]);
  const body = {
    ok: fuel.status === "fulfilled" && ev.status === "fulfilled",
    fuel:
      fuel.status === "fulfilled"
        ? { ministryDate: fuel.value.ministryDate, stations: fuel.value.stations.length }
        : { error: String(fuel.reason) },
    ev:
      ev.status === "fulfilled"
        ? ev.value
          ? { sourceDate: ev.value.sourceDate, sites: ev.value.items.length }
          : "sin cambios (datos de menos de 6 h)"
        : { error: String(ev.reason) },
    ms: Date.now() - started,
  };
  if (!body.ok) console.error("[cron/refresh]", body);
  return Response.json(body, { status: body.ok ? 200 : 500 });
}

/**
 * Interpreta el campo "Horario" de la API del Ministerio y dice si una gasolinera está abierta.
 *
 * Formatos reales vistos (05/10/2026, 86 variantes): "L-D: 24H", "L-D: 07:00-22:00",
 * "L-V: 06:00-22:00; S: 07:00-15:00", "L-S: 07:00-14:00 y 16:00-21:00; D: 08:00-14:00", "L-S: 8:00 -21:00"…
 * Si algo no encaja, devolvemos "unknown": preferimos no afirmar nada a afirmar algo falso.
 */

const DAY_LETTERS = "LMXJVSD"; // lunes = 0
const MIN_PER_DAY = 1440;
const MIN_PER_WEEK = 7 * MIN_PER_DAY;

/** Intervalos abiertos en minutos de la semana [inicio, fin), con el lunes 00:00 = 0. */
export type WeeklySchedule = [number, number][];

export function parseHours(raw: string): WeeklySchedule | null {
  const text = raw.trim();
  if (!text) return null;
  const intervals: [number, number][] = [];
  const daysSeen = new Set<number>();

  for (const part of text.split(";")) {
    const m = part.trim().match(/^([LMXJVSD])(?:\s*-\s*([LMXJVSD]))?\s*:\s*(.+)$/);
    if (!m) return null;
    const from = DAY_LETTERS.indexOf(m[1]);
    const to = m[2] ? DAY_LETTERS.indexOf(m[2]) : from;
    const days: number[] = [];
    for (let d = from; ; d = (d + 1) % 7) {
      days.push(d);
      if (d === to) break;
    }

    const ranges: [number, number][] = [];
    const spec = m[3].trim();
    if (/^24\s*H$/i.test(spec)) {
      ranges.push([0, MIN_PER_DAY]);
    } else {
      for (const r of spec.split(/\s+y\s+/)) {
        const t = r.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
        if (!t) return null;
        const start = Number(t[1]) * 60 + Number(t[2]);
        let end = Number(t[3]) * 60 + Number(t[4]);
        if (start > MIN_PER_DAY || end > MIN_PER_DAY) return null;
        if (end === 0) end = MIN_PER_DAY; // "22:00-00:00"
        // Rangos que cruzan medianoche ("22:00-06:00") siguen al día siguiente.
        const length = end > start ? end - start : MIN_PER_DAY - start + end;
        // Datos claramente erróneos, como "00:01-00:02".
        if (length < 30) return null;
        ranges.push([start, start + length]);
      }
    }

    for (const d of days) {
      daysSeen.add(d);
      for (const [s, e] of ranges) intervals.push([d * MIN_PER_DAY + s, d * MIN_PER_DAY + e]);
    }
  }

  // "L: 07:00-22:00" a secas aparece en cientos de estaciones que en la práctica abren a diario:
  // es ambiguo, así que no lo interpretamos.
  if (daysSeen.size === 1 && daysSeen.has(0)) return null;
  return mergeWeekly(intervals);
}

/** Normaliza a [0, semana), une solapes y une el domingo noche con el lunes. */
function mergeWeekly(intervals: [number, number][]): WeeklySchedule {
  const split: [number, number][] = [];
  for (const [s, e] of intervals) {
    if (e <= MIN_PER_WEEK) split.push([s, e]);
    else split.push([s, MIN_PER_WEEK], [0, e - MIN_PER_WEEK]);
  }
  split.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of split) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

export type OpenStatus = "open" | "closingSoon" | "closed" | "unknown";

export interface OpenState {
  status: OpenStatus;
  /** Minutos hasta el cierre (abierta) o hasta la apertura (cerrada). undefined = abierta 24 h todos los días. */
  minutes?: number;
  label: string;
}

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Minuto de la semana (lunes 00:00 = 0) para una fecha en una zona horaria. */
export function minuteOfWeek(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return WEEKDAY_INDEX[get("weekday")] * MIN_PER_DAY + Number(get("hour")) * 60 + Number(get("minute"));
}

const hhmm = (minuteOfWeekValue: number) => {
  const m = ((minuteOfWeekValue % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Por debajo de estos minutos para cerrar avisamos: puede que llegues con la persiana bajada. */
export const CLOSING_SOON_MIN = 30;

export function openStateAt(schedule: WeeklySchedule | null, now: number): OpenState {
  if (!schedule || schedule.length === 0) return { status: "unknown", label: "Horario sin confirmar" };
  if (schedule.length === 1 && schedule[0][0] === 0 && schedule[0][1] === MIN_PER_WEEK) {
    return { status: "open", label: "Abierta 24 h" };
  }

  for (const [s, e] of schedule) {
    // El intervalo que acaba el domingo a medianoche continúa en el que empieza el lunes a las 00:00.
    const wrapsIntoMonday = e === MIN_PER_WEEK && schedule[0][0] === 0;
    const effectiveEnd = wrapsIntoMonday ? MIN_PER_WEEK + schedule[0][1] : e;
    if (now >= s && now < effectiveEnd) {
      const minutes = effectiveEnd - now;
      return minutes <= CLOSING_SOON_MIN
        ? { status: "closingSoon", minutes, label: `Cierra pronto (${hhmm(effectiveEnd)})` }
        : { status: "open", minutes, label: `Abierta · cierra a las ${hhmm(effectiveEnd)}` };
    }
  }
  const next = schedule.find(([s]) => s > now) ?? schedule[0];
  const minutes = next[0] > now ? next[0] - now : MIN_PER_WEEK - now + next[0];
  const sameDay = Math.floor(next[0] / MIN_PER_DAY) === Math.floor(now / MIN_PER_DAY) && next[0] > now;
  const when = sameDay ? `a las ${hhmm(next[0])}` : `el ${DAY_NAMES[Math.floor(next[0] / MIN_PER_DAY)]} a las ${hhmm(next[0])}`;
  return { status: "closed", minutes, label: `Cerrada · abre ${when}` };
}

/** Zona horaria por provincia: Canarias va una hora por detrás de la península. */
export function timeZoneForProvince(province: string): string {
  return /PALMAS|TENERIFE/i.test(province) ? "Atlantic/Canary" : "Europe/Madrid";
}

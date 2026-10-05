-- GasolinaNeta: cachés de datos públicos.
-- Ejecuta esto una vez en Supabase → SQL Editor.
-- Cada fila es una "foto" completa de una fuente oficial (jsonb). El servidor guarda solo las 3 más recientes.
--
--   fuel_snapshots : precios de carburantes del Ministerio (~11.000 gasolineras, ~2-3 MB). Se refresca cada 10-30 min.
--   ev_snapshots   : puntos de recarga del NAP de la DGT (~12.000 emplazamientos, ~5 MB). Se refresca cada ~6 h.
--
-- Los precios de recarga NO están aquí: no existe fuente pública. Son una tabla curada a mano y versionada
-- en el código (src/lib/ev/operatorPrices.ts), con fuente y fecha de cada precio.

create table if not exists public.fuel_snapshots (
  id          bigint generated always as identity primary key,
  source_date text        not null,          -- fecha que declara la fuente, tal cual
  fetched_at  timestamptz not null default now(),
  item_count  integer     not null,
  items       jsonb       not null
);
create index if not exists fuel_snapshots_fetched_at_idx on public.fuel_snapshots (fetched_at desc);

create table if not exists public.ev_snapshots (
  id          bigint generated always as identity primary key,
  source_date text        not null,
  fetched_at  timestamptz not null default now(),
  item_count  integer     not null,
  items       jsonb       not null
);
create index if not exists ev_snapshots_fetched_at_idx on public.ev_snapshots (fetched_at desc);

-- Solo el servidor (service role) lee y escribe; con RLS activo y sin políticas, la clave anónima no ve nada.
alter table public.fuel_snapshots enable row level security;
alter table public.ev_snapshots enable row level security;

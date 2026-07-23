-- Pampa · Control de cuotas — esquema de base de datos (Supabase / Postgres)
-- Ejecutá este script una sola vez en Supabase: Dashboard -> SQL Editor -> New query -> pegar -> Run.

-- ---------------------------------------------------------------------------
-- alumnos: datos base importados desde la planilla (export del sistema).
-- Estas columnas son el "punto de partida". NO se modifican al cargar pagos:
-- los pagos nuevos van a la tabla `pagos` y el saldo se recalcula en la app.
-- ---------------------------------------------------------------------------
create table if not exists public.alumnos (
  alumno_id          uuid primary key,
  alumno             text not null,
  nombre_cliente     text,
  organizacion       text not null,
  nro_orden          text,
  estado_orden       text,
  fecha_orden        date,
  forma_de_pago      text,
  plan_cuotas        integer not null default 1,
  cuotas_generadas   integer not null default 0,
  cuotas_pagadas_base integer not null default 0,
  total_asignado     numeric not null default 0,
  monto_pagado_base  numeric not null default 0,
  saldo_base         numeric not null default 0,
  situacion_base     text
);

create index if not exists alumnos_organizacion_idx on public.alumnos (organizacion);

-- ---------------------------------------------------------------------------
-- pagos: registro (ledger) de pagos NUEVOS cargados desde la app.
-- El saldo vivo de un alumno = total_asignado - (monto_pagado_base + suma de pagos).
-- ---------------------------------------------------------------------------
create table if not exists public.pagos (
  id            bigint generated always as identity primary key,
  alumno_id     uuid not null references public.alumnos (alumno_id) on delete cascade,
  fecha         date not null default current_date,
  monto         numeric not null check (monto >= 0),
  forma_de_pago text,
  interes       numeric not null default 0 check (interes >= 0),
  nota          text,
  creado_en     timestamptz not null default now()
);

create index if not exists pagos_alumno_idx on public.pagos (alumno_id);

-- Nota: para este prototipo el acceso a la base se hace del lado del servidor
-- (Next.js Route Handlers) usando la Service Role Key, que nunca se expone al
-- navegador. Por eso NO habilitamos Row Level Security acá. Si más adelante se
-- quiere exponer con la anon key, hay que agregar políticas RLS.

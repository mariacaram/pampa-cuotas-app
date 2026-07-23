# Pampa · Control de cuotas

App web para seguir el pago de cuotas de cada alumno, por colegio, y **registrar pagos nuevos**
que se guardan de forma persistente.

- Elegís un **colegio** (199 en total) → se cargan sus **alumnos**.
- Ves del alumno: total asignado, pagado, **saldo**, plan de cuotas, cuotas pagadas/pendientes
  y situación (PAGO TOTAL / PARCIAL / SIN PAGOS).
- **Registrás un pago** (monto, fecha, forma de pago, y opcionalmente un interés por atraso).
  El saldo y las cuotas se **recalculan solos** y el pago queda guardado en la base de datos.

## Cómo están organizados los datos

La planilla de Google es un **export de otro sistema** (se regenera sola), así que la app **no
escribe sobre ella**. En su lugar:

- La planilla se **importa una vez** a la tabla `alumnos` de una base de datos (Supabase). Son
  los datos "base" (total, pagado inicial, plan de cuotas).
- Los **pagos nuevos** que cargás desde la app van a una tabla aparte, `pagos` (con historial).
- El saldo vivo = `total_asignado − (pagado_base + suma de pagos nuevos)`.

Así nunca se pisan los datos ni se pierde lo que cargaste, aunque el export se regenere.

> Los datos reales (nombres de alumnos/clientes) **no están en este repo** (por privacidad).
> Viven solo en la base de datos. Para desarrollo local se usa `data/alumnos.local.json`, que
> está ignorado por git.

## Puesta en marcha (una sola vez)

### 1. Crear el proyecto en Supabase (gratis)

1. Entrá a https://supabase.com → **Start your project** → creá una cuenta.
2. **New project** → ponele un nombre (ej. `pampa`), elegí una contraseña y una región cercana.
   Esperá ~2 minutos a que se cree.
3. Andá a **SQL Editor** → **New query**, pegá el contenido de [`supabase/schema.sql`](supabase/schema.sql)
   y tocá **Run**. Esto crea las tablas `alumnos` y `pagos`.

### 2. Conseguir las 2 claves

En Supabase, **Project Settings**:

- **Data API → Project URL** → esto es `SUPABASE_URL`.
- **API Keys → `service_role`** (la secreta) → esto es `SUPABASE_SERVICE_ROLE_KEY`.

### 3. Importar la planilla a la base

```bash
cp .env.local.example .env.local     # y completá las 2 claves
npm install
npm run seed                          # importa los ~5500 alumnos a Supabase
```

### 4. Correr localmente

```bash
npm run dev
```

Abrí http://localhost:3000. Con las claves puestas, la app usa Supabase; sin claves, usa el
archivo local (`data/alumnos.local.json`) en "modo prueba".

### 5. Producción (Vercel)

En el proyecto de Vercel → **Settings → Environment Variables**, agregá `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY` (los mismos valores). Redeploy y listo.

## Notas técnicas

- El acceso a la base es siempre del **lado del servidor** (Next.js Route Handlers en
  `src/app/api/*`). La `service_role` key nunca llega al navegador.
- Volver a correr `npm run seed` actualiza los datos base (upsert por `alumno_id`) sin borrar
  los pagos cargados.

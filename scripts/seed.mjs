// Importa la planilla de alumnos a la tabla `alumnos` de Supabase.
//
// Uso:
//   1) Cargá el esquema una vez (supabase/schema.sql) en Supabase (SQL Editor).
//   2) Poné SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
//   3) node --env-file=.env.local scripts/seed.mjs
//
// Fuente de datos (en este orden):
//   - data/alumnos.local.json  (si existe)
//   - si no, baja la planilla de Google (SHEET_ID) y la parsea.
//
// La tabla `pagos` NO se toca: los pagos nuevos se cargan desde la app.
// Volver a correr este script actualiza los datos base (upsert por alumno_id).

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const SHEET_ID = process.env.SHEET_ID || "1Xx3Lm7DOavgpzGbFFxDSq3hxg7gWdoV6yzhJmh-YLlA";
const LOCAL_FILE = path.join(process.cwd(), "data", "alumnos.local.json");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Falta SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (ver .env.local).");
  process.exit(1);
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function str(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}
function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = str(v);
  return s ? s.slice(0, 10) : null;
}

async function loadRows() {
  if (fs.existsSync(LOCAL_FILE)) {
    console.log("Leyendo datos de", LOCAL_FILE);
    const rows = JSON.parse(fs.readFileSync(LOCAL_FILE, "utf-8"));
    return rows.map((r) => ({ ...r, fecha_orden: r.fecha_orden || null }));
  }

  console.log("Descargando planilla de Google (SHEET_ID=" + SHEET_ID + ")…");
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`
  );
  if (!res.ok) throw new Error("No se pudo descargar la planilla: HTTP " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
  const header = raw[0].map((h) => String(h).trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  return raw
    .slice(1)
    .filter((r) => r[idx["alumno_id"]])
    .map((r) => ({
      alumno_id: str(r[idx["alumno_id"]]),
      alumno: str(r[idx["alumno"]]),
      nombre_cliente: str(r[idx["nombre_cliente"]]),
      organizacion: str(r[idx["organizacion"]]),
      nro_orden: str(r[idx["nro_orden"]]).replace(".0", ""),
      estado_orden: str(r[idx["estado_orden"]]),
      fecha_orden: toDate(r[idx["fecha_orden"]]),
      forma_de_pago: str(r[idx["forma_de_pago"]]),
      plan_cuotas: Math.trunc(num(r[idx["plan_cuotas"]])),
      cuotas_generadas: Math.trunc(num(r[idx["cuotas_generadas"]])),
      cuotas_pagadas_base: Math.trunc(num(r[idx["cuotas_pagadas"]])),
      total_asignado: num(r[idx["total_asignado"]]),
      monto_pagado_base: num(r[idx["monto_pagado"]]),
      saldo_base: num(r[idx["saldo_pendiente"]]),
      situacion_base: str(r[idx["situacion"]]),
    }));
}

async function main() {
  const rows = await loadRows();
  console.log(`Filas a importar: ${rows.length}`);

  const db = createClient(url, key, { auth: { persistSession: false } });

  const BATCH = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await db.from("alumnos").upsert(chunk, { onConflict: "alumno_id" });
    if (error) {
      console.error("Error en el lote", i, "->", error.message);
      process.exit(1);
    }
    done += chunk.length;
    console.log(`  importados ${done}/${rows.length}`);
  }

  console.log("✓ Importación completa.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Importes de cuota cargados a mano por Paulina para un alumno puntual (ej.: alguien que se
// suma después a un colegio con un precio distinto al del resto). Paulina pidió explícitamente
// NO agregar columnas nuevas a la tabla `alumnos` en Supabase, así que esto se guarda como un
// archivo JSON en Supabase Storage — el mismo mecanismo que ya usa Usuarios/Auditoría
// (src/lib/server/usuarios.ts) — en vez de una columna o tabla nueva.

export type CuotaManualRow = {
  alumno_id: string;
  montos: number[]; // uno por cuota, en orden (1ª, 2ª, 3ª...)
  actualizado_por: string | null;
  actualizado_en: string;
};

let admin: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!admin) {
    admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return admin;
}

const BUCKET = "app-logs";
const FILE = "cuotas_manuales.json";

async function ensureBucket(client: SupabaseClient): Promise<void> {
  await client.storage.createBucket(BUCKET, { public: false }).catch(() => {});
}

async function readAll(client: SupabaseClient): Promise<CuotaManualRow[]> {
  const { data, error } = await client.storage.from(BUCKET).download(FILE);
  if (error || !data) return [];
  try {
    const arr = JSON.parse(await data.text());
    return Array.isArray(arr) ? (arr as CuotaManualRow[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(client: SupabaseClient, rows: CuotaManualRow[]): Promise<void> {
  await client.storage.from(BUCKET).upload(FILE, Buffer.from(JSON.stringify(rows)), {
    upsert: true,
    contentType: "application/json",
  });
}

// Devuelve un mapa alumno_id -> montos, para usar en cálculos masivos (export, tablero, etc.)
// sin tener que pedir el archivo una vez por alumno.
export async function listCuotasManuales(): Promise<Map<string, number[]>> {
  const client = db();
  if (!client) return new Map();
  const rows = await readAll(client);
  return new Map(rows.map((r) => [r.alumno_id, r.montos]));
}

export async function getCuotasManuales(alumnoId: string): Promise<number[] | null> {
  const client = db();
  if (!client) return null;
  const rows = await readAll(client);
  return rows.find((r) => r.alumno_id === alumnoId)?.montos ?? null;
}

export async function setCuotasManuales(
  alumnoId: string,
  montos: number[],
  usuarioEmail: string | null
): Promise<void> {
  const client = db();
  if (!client) throw new Error("Supabase no configurado");
  await ensureBucket(client);
  const rows = await readAll(client);
  const idx = rows.findIndex((r) => r.alumno_id === alumnoId);
  const row: CuotaManualRow = {
    alumno_id: alumnoId,
    montos,
    actualizado_por: usuarioEmail,
    actualizado_en: new Date().toISOString(),
  };
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
  await writeAll(client, rows);
}

// Vuelve al reparto automático (borra los importes manuales de este alumno).
export async function borrarCuotasManuales(alumnoId: string): Promise<void> {
  const client = db();
  if (!client) return;
  const rows = await readAll(client);
  const filtradas = rows.filter((r) => r.alumno_id !== alumnoId);
  if (filtradas.length !== rows.length) await writeAll(client, filtradas);
}

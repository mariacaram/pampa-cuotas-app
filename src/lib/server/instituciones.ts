import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Instituciones (colegio / club / empresa) = el "cliente general". Se guardan en
// Supabase Storage (mismo bucket que usuarios/auditoría), sin necesidad de tablas.
// Los alumnos siguen en la tabla `alumnos` con organizacion = nombre de la institución.

export type TipoInstitucion = "colegio" | "club" | "empresa";

export type Institucion = {
  nombre: string;
  tipo: TipoInstitucion;
  referente_nombre: string;
  referente_apellido: string;
  contacto: string; // teléfono y/o email del referente
  creado_en: string;
  creado_por: string | null;
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
const FILE = "instituciones.json";

async function ensureBucket(client: SupabaseClient): Promise<void> {
  await client.storage.createBucket(BUCKET, { public: false }).catch(() => {});
}

async function readAll(client: SupabaseClient): Promise<Institucion[]> {
  const { data, error } = await client.storage.from(BUCKET).download(FILE);
  if (error || !data) return [];
  try {
    const arr = JSON.parse(await data.text());
    return Array.isArray(arr) ? (arr as Institucion[]) : [];
  } catch {
    return [];
  }
}

export async function listInstituciones(): Promise<Institucion[]> {
  const client = db();
  if (!client) return [];
  return (await readAll(client)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function addInstitucion(input: {
  nombre: string;
  tipo: TipoInstitucion;
  referente_nombre: string;
  referente_apellido: string;
  contacto?: string;
  creadoPor?: string | null;
}): Promise<Institucion> {
  const client = db();
  const inst: Institucion = {
    nombre: input.nombre.trim(),
    tipo: input.tipo,
    referente_nombre: input.referente_nombre.trim(),
    referente_apellido: input.referente_apellido.trim(),
    contacto: (input.contacto || "").trim(),
    creado_en: new Date().toISOString(),
    creado_por: input.creadoPor ?? null,
  };
  if (!client) return inst;
  await ensureBucket(client);
  const all = await readAll(client);
  const i = all.findIndex((x) => x.nombre.toLowerCase().trim() === inst.nombre.toLowerCase());
  if (i >= 0) all[i] = { ...all[i], ...inst, creado_en: all[i].creado_en };
  else all.push(inst);
  await client.storage.from(BUCKET).upload(FILE, Buffer.from(JSON.stringify(all)), {
    upsert: true,
    contentType: "application/json",
  });
  return inst;
}

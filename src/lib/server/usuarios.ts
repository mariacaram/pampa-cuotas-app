import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type Usuario = {
  email: string;
  nombre: string | null;
  rol: "admin" | "miembro";
  estado: "pendiente" | "aprobado" | "rechazado";
  creado_en: string;
  ultimo_ingreso: string | null;
  aprobado_por: string | null;
  aprobado_en: string | null;
};

// Usuarios que ya vienen habilitados de fábrica (admins + miembros aprobadas).
const SEED: { email: string; nombre: string; rol: "admin" | "miembro" }[] = [
  { email: "mindloopia.auth@gmail.com", nombre: "Maria", rol: "admin" },
  { email: "paulina.ferreyrab@gmail.com", nombre: "Paulina", rol: "admin" },
  { email: "camilagonzalezxz@gmail.com", nombre: "Camila", rol: "miembro" },
  { email: "anto.madori@gmail.com", nombre: "Anto", rol: "miembro" },
];

function seedUsuario(s: (typeof SEED)[number]): Usuario {
  return {
    email: s.email,
    nombre: s.nombre,
    rol: s.rol,
    estado: "aprobado",
    creado_en: new Date().toISOString(),
    ultimo_ingreso: null,
    aprobado_por: "seed",
    aprobado_en: new Date().toISOString(),
  };
}

// Cliente service role (server-only). Se usa para Storage (usuarios + auditoría).
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
const USERS_FILE = "usuarios.json";
const AUDIT_FILE = "auditoria.json";
const MAX_AUDIT = 2000;

async function ensureBucket(client: SupabaseClient): Promise<void> {
  await client.storage.createBucket(BUCKET, { public: false }).catch(() => {});
}

async function downloadJson<T>(client: SupabaseClient, file: string): Promise<T[]> {
  const { data, error } = await client.storage.from(BUCKET).download(file);
  if (error || !data) return [];
  try {
    const arr = JSON.parse(await data.text());
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

async function uploadJson(client: SupabaseClient, file: string, value: unknown): Promise<void> {
  await client.storage.from(BUCKET).upload(file, Buffer.from(JSON.stringify(value)), {
    upsert: true,
    contentType: "application/json",
  });
}

// Lee la lista de usuarios y garantiza que las semillas (admins/pre-aprobadas) existan.
async function readUsers(client: SupabaseClient): Promise<Usuario[]> {
  const stored = await downloadJson<Usuario>(client, USERS_FILE);
  const byEmail = new Map(stored.map((u) => [u.email.toLowerCase().trim(), u]));
  let changed = false;
  for (const s of SEED) {
    if (!byEmail.has(s.email)) {
      byEmail.set(s.email, seedUsuario(s));
      changed = true;
    }
  }
  const list = [...byEmail.values()];
  if (changed) await uploadJson(client, USERS_FILE, list);
  return list;
}

// ---------------- Usuarios ----------------

// Devuelve el usuario; si no existe lo crea como 'pendiente'. Marca el ingreso.
export async function getOrCreateUsuario(email: string, nombre: string | null): Promise<Usuario> {
  const e = email.toLowerCase().trim();
  const client = db();
  if (!client) {
    // Sin Storage: devolvemos un usuario transitorio (semilla = aprobado, resto = pendiente).
    const s = SEED.find((x) => x.email === e);
    return s ? seedUsuario(s) : {
      email: e, nombre, rol: "miembro", estado: "pendiente",
      creado_en: new Date().toISOString(), ultimo_ingreso: new Date().toISOString(),
      aprobado_por: null, aprobado_en: null,
    };
  }
  await ensureBucket(client);
  const users = await readUsers(client);
  const idx = users.findIndex((u) => u.email.toLowerCase().trim() === e);
  if (idx >= 0) {
    users[idx].ultimo_ingreso = new Date().toISOString();
    if (!users[idx].nombre && nombre) users[idx].nombre = nombre;
    await uploadJson(client, USERS_FILE, users);
    return users[idx];
  }
  const nuevo: Usuario = {
    email: e, nombre, rol: "miembro", estado: "pendiente",
    creado_en: new Date().toISOString(), ultimo_ingreso: new Date().toISOString(),
    aprobado_por: null, aprobado_en: null,
  };
  users.push(nuevo);
  await uploadJson(client, USERS_FILE, users);
  return nuevo;
}

export async function getUsuario(email: string): Promise<Usuario | null> {
  const e = email.toLowerCase().trim();
  const client = db();
  if (!client) {
    const s = SEED.find((x) => x.email === e);
    return s ? seedUsuario(s) : null;
  }
  const users = await readUsers(client);
  return users.find((u) => u.email.toLowerCase().trim() === e) ?? null;
}

export async function listUsuarios(): Promise<Usuario[]> {
  const client = db();
  if (!client) return SEED.map(seedUsuario);
  const users = await readUsers(client);
  return users.sort((a, b) => (a.creado_en < b.creado_en ? 1 : -1));
}

export async function setEstadoUsuario(
  email: string,
  estado: "aprobado" | "rechazado",
  aprobadoPor: string
): Promise<void> {
  const client = db();
  if (!client) return;
  const e = email.toLowerCase().trim();
  const users = await readUsers(client);
  const idx = users.findIndex((u) => u.email.toLowerCase().trim() === e);
  if (idx < 0) return;
  users[idx].estado = estado;
  users[idx].aprobado_por = aprobadoPor;
  users[idx].aprobado_en = new Date().toISOString();
  await uploadJson(client, USERS_FILE, users);
}

export async function esAdmin(email: string): Promise<boolean> {
  const u = await getUsuario(email);
  return u?.rol === "admin" && u.estado === "aprobado";
}

// ---------------- Auditoría (Supabase Storage) ----------------

export type AuditoriaRow = {
  id: number;
  usuario_email: string | null;
  accion: string;
  entidad: string | null;
  detalle: Record<string, unknown> | null;
  creado_en: string;
};

export async function logAuditoria(
  usuarioEmail: string | null,
  accion: string,
  entidad?: string,
  detalle?: Record<string, unknown>
): Promise<void> {
  const client = db();
  if (!client) return;
  try {
    await ensureBucket(client);
    const rows = await downloadJson<AuditoriaRow>(client, AUDIT_FILE);
    rows.push({
      id: Date.now(),
      usuario_email: usuarioEmail,
      accion,
      entidad: entidad ?? null,
      detalle: detalle ?? null,
      creado_en: new Date().toISOString(),
    });
    await uploadJson(client, AUDIT_FILE, rows.slice(-MAX_AUDIT));
  } catch {
    // La auditoría nunca debe romper la operación principal.
  }
}

export async function listAuditoria(limit = 300): Promise<AuditoriaRow[]> {
  const client = db();
  if (!client) return [];
  const rows = await downloadJson<AuditoriaRow>(client, AUDIT_FILE);
  return rows.slice(-limit).reverse();
}

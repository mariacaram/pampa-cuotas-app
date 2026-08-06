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

// Cliente con service role (server-only). Salta RLS. Usado para usuarios y auditoría.
let admin: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!admin) {
    admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return admin;
}

// Busca el usuario; si no existe lo crea como 'pendiente'. Marca el último ingreso.
export async function getOrCreateUsuario(email: string, nombre: string | null): Promise<Usuario> {
  const e = email.toLowerCase().trim();
  const { data: existing } = await db().from("app_usuarios").select("*").eq("email", e).maybeSingle();
  if (existing) {
    await db().from("app_usuarios").update({ ultimo_ingreso: new Date().toISOString() }).eq("email", e);
    return existing as Usuario;
  }
  const { data, error } = await db()
    .from("app_usuarios")
    .insert({ email: e, nombre, estado: "pendiente", rol: "miembro", ultimo_ingreso: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as Usuario;
}

export async function esAdmin(email: string): Promise<boolean> {
  const { data } = await db()
    .from("app_usuarios")
    .select("rol,estado")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  return data?.rol === "admin" && data?.estado === "aprobado";
}

export async function listUsuarios(): Promise<Usuario[]> {
  const { data } = await db().from("app_usuarios").select("*").order("creado_en", { ascending: false });
  return (data ?? []) as Usuario[];
}

export async function setEstadoUsuario(
  email: string,
  estado: "aprobado" | "rechazado",
  aprobadoPor: string
): Promise<void> {
  await db()
    .from("app_usuarios")
    .update({ estado, aprobado_por: aprobadoPor, aprobado_en: new Date().toISOString() })
    .eq("email", email.toLowerCase().trim());
}

// ---------------- Auditoría ----------------
export async function logAuditoria(
  usuarioEmail: string | null,
  accion: string,
  entidad?: string,
  detalle?: Record<string, unknown>
): Promise<void> {
  try {
    await db().from("app_auditoria").insert({
      usuario_email: usuarioEmail,
      accion,
      entidad: entidad ?? null,
      detalle: detalle ?? null,
    });
  } catch {
    // La auditoría nunca debe romper la operación principal.
  }
}

export type AuditoriaRow = {
  id: number;
  usuario_email: string | null;
  accion: string;
  entidad: string | null;
  detalle: Record<string, unknown> | null;
  creado_en: string;
};

export async function listAuditoria(limit = 300): Promise<AuditoriaRow[]> {
  const { data } = await db()
    .from("app_auditoria")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(limit);
  return (data ?? []) as AuditoriaRow[];
}

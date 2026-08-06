import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUsuario, Usuario } from "./usuarios";

// Email + nombre del usuario logueado (o null si no hay sesión).
export async function getSessionUser(): Promise<{ email: string; nombre: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const nombre =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;
  return { email: user.email, nombre };
}

// Usuario de la app (crea el registro 'pendiente' en el primer ingreso). null si no hay sesión.
export async function getCurrentUsuario(): Promise<Usuario | null> {
  const sess = await getSessionUser();
  if (!sess) return null;
  return getOrCreateUsuario(sess.email, sess.nombre);
}

// Para route handlers: devuelve el usuario si está APROBADO, si no null (el caller corta con 401/403).
export async function requireApproved(): Promise<Usuario | null> {
  const u = await getCurrentUsuario();
  if (!u || u.estado !== "aprobado") return null;
  return u;
}

// Guarda de APIs con degradación segura: si el login no está configurado, la app queda abierta.
export async function guardApi(): Promise<{ ok: boolean; usuario: Usuario | null }> {
  const authConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!authConfigured) return { ok: true, usuario: null };
  const u = await requireApproved();
  return { ok: !!u, usuario: u };
}

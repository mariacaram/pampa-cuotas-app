import "server-only";
import { authConfigured, getSessionFromCookie } from "./session";
import { getUsuario, Usuario } from "./usuarios";

// Email + nombre del usuario logueado (o null si no hay sesión).
export async function getSessionUser(): Promise<{ email: string; nombre: string | null } | null> {
  const u = await getSessionFromCookie();
  if (!u) return null;
  return { email: u.email, nombre: u.nombre };
}

// Usuario de la app (con su estado real desde el store en Storage). null si no hay sesión.
export async function getCurrentUsuario(): Promise<Usuario | null> {
  const sess = await getSessionFromCookie();
  if (!sess) return null;
  const u = await getUsuario(sess.email);
  // Si por algún motivo no está en el store, lo tratamos como pendiente.
  if (!u) {
    return {
      email: sess.email, nombre: sess.nombre, rol: "miembro", estado: "pendiente",
      creado_en: "", ultimo_ingreso: null, aprobado_por: null, aprobado_en: null,
    };
  }
  return u;
}

// Para route handlers: devuelve el usuario si está APROBADO, si no null.
export async function requireApproved(): Promise<Usuario | null> {
  const u = await getCurrentUsuario();
  if (!u || u.estado !== "aprobado") return null;
  return u;
}

// Guarda de APIs con degradación segura: si el login no está configurado, la app queda abierta.
export async function guardApi(): Promise<{ ok: boolean; usuario: Usuario | null }> {
  if (!authConfigured()) return { ok: true, usuario: null };
  const u = await requireApproved();
  return { ok: !!u, usuario: u };
}

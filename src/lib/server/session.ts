import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Sesión de la app: una cookie firmada con HMAC (APP_AUTH_SECRET). No depende
// de ningún servicio externo. El login se hace con Google (ver googleAuth.ts);
// acá sólo guardamos/leemos la sesión ya autenticada.
// ---------------------------------------------------------------------------

export type Rol = "admin" | "miembro";

export type AppUser = {
  email: string;
  nombre: string | null;
  rol: Rol;
};

const COOKIE_NAME = "pampa_session";
const SESSION_DAYS = 30;

// ¿Está configurado el login? Si falta la config, la app queda ABIERTA.
export function authConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && !!process.env.APP_AUTH_SECRET;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", process.env.APP_AUTH_SECRET!).update(payloadB64).digest("base64url");
}

function makeToken(user: AppUser): string {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = b64url(JSON.stringify({ e: user.email, n: user.nombre, r: user.rol, exp }));
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string | undefined): AppUser | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.exp || Date.now() > data.exp) return null;
    return { email: data.e, nombre: data.n ?? null, rol: data.r === "admin" ? "admin" : "miembro" };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: AppUser): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, makeToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSessionFromCookie(): Promise<AppUser | null> {
  const store = await cookies();
  return readToken(store.get(COOKIE_NAME)?.value);
}

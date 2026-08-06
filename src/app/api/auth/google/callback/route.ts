import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForProfile } from "@/lib/server/googleAuth";
import { setSessionCookie } from "@/lib/server/session";
import { getOrCreateUsuario, logAuditoria } from "@/lib/server/usuarios";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.cookies.get("pampa_oauth_state")?.value;
  const home = new URL("/", url.origin);

  // Verificaciones básicas (code presente + state coincide con la cookie).
  if (!code || !state || !savedState || state !== savedState) {
    home.searchParams.set("auth_error", "1");
    return NextResponse.redirect(home);
  }

  const redirectUri = new URL("/api/auth/google/callback", url.origin).toString();
  const profile = await exchangeCodeForProfile(code, redirectUri);
  if (!profile || !profile.email) {
    home.searchParams.set("auth_error", "1");
    return NextResponse.redirect(home);
  }

  // Crea el usuario (pendiente) si es nuevo y marca el ingreso.
  const usuario = await getOrCreateUsuario(profile.email, profile.nombre);
  await setSessionCookie({ email: usuario.email, nombre: usuario.nombre, rol: usuario.rol });
  await logAuditoria(usuario.email, "login");

  const res = NextResponse.redirect(home);
  res.cookies.set("pampa_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}

import { NextRequest, NextResponse } from "next/server";
import { getHistorial } from "@/lib/server/historial";
import { guardApi } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

function defaultRange() {
  const now = new Date();
  // Por defecto, los últimos 30 días (el historial se usa para revisar lo cargado hace poco).
  const desde = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { desde, hasta: now.toISOString().slice(0, 10) };
}

export async function GET(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const def = defaultRange();
  const desde = req.nextUrl.searchParams.get("desde") || def.desde;
  const hasta = req.nextUrl.searchParams.get("hasta") || def.hasta;
  try {
    const historial = await getHistorial(
      desde,
      hasta,
      g.usuario ? { email: g.usuario.email, rol: g.usuario.rol } : null
    );
    return NextResponse.json({ historial });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

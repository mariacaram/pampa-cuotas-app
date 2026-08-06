import { NextRequest, NextResponse } from "next/server";
import { getCobranza, CobranzaModo } from "@/lib/server/stats";
import { guardApi } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const organizacion = req.nextUrl.searchParams.get("organizacion") || undefined;
  const modoParam = req.nextUrl.searchParams.get("modo");
  const modo: CobranzaModo =
    modoParam === "atrasado" || modoParam === "esteMes" ? modoParam : "todos";

  try {
    const cobranza = await getCobranza(modo, organizacion);
    return NextResponse.json({ cobranza });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

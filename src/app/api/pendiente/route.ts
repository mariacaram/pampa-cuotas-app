import { NextRequest, NextResponse } from "next/server";
import { getPendiente } from "@/lib/server/stats";
import { guardApi } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const organizacion = req.nextUrl.searchParams.get("organizacion") || undefined;
  try {
    const pendiente = await getPendiente(organizacion);
    return NextResponse.json({ pendiente });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

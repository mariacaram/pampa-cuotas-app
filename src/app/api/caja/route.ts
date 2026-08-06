import { NextRequest, NextResponse } from "next/server";
import { getCaja } from "@/lib/server/caja";
import { guardApi } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

function defaultRange() {
  const now = new Date();
  const desde = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const hasta = now.toISOString().slice(0, 10);
  return { desde, hasta };
}

export async function GET(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const def = defaultRange();
  const desde = req.nextUrl.searchParams.get("desde") || def.desde;
  const hasta = req.nextUrl.searchParams.get("hasta") || def.hasta;
  try {
    const caja = await getCaja(desde, hasta);
    return NextResponse.json({ caja });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

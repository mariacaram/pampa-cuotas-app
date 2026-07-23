import { NextRequest, NextResponse } from "next/server";
import { getPendiente } from "@/lib/server/stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const organizacion = req.nextUrl.searchParams.get("organizacion") || undefined;
  try {
    const pendiente = await getPendiente(organizacion);
    return NextResponse.json({ pendiente });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

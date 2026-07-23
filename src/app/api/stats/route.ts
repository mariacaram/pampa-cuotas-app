import { NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/server/stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const organizacion = req.nextUrl.searchParams.get("organizacion") || undefined;
  try {
    const stats = await getStats(organizacion);
    return NextResponse.json({ stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

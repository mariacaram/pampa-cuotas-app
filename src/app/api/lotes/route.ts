import { NextResponse } from "next/server";
import { getLotes } from "@/lib/server/lotes";
import { guardApi } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const lotes = await getLotes();
    return NextResponse.json({ lotes });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

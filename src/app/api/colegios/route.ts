import { NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";
import { guardApi } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const repo = await getRepo();
    const colegios = await repo.listColegios();
    return NextResponse.json({ colegios, source: repo.source });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

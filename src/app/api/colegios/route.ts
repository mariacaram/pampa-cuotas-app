import { NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repo = await getRepo();
    const colegios = await repo.listColegios();
    return NextResponse.json({ colegios, source: repo.source });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

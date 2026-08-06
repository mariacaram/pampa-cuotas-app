import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";
import { guardApi } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const organizacion = req.nextUrl.searchParams.get("organizacion");
  if (!organizacion) {
    return NextResponse.json({ error: "Falta el parámetro organizacion" }, { status: 400 });
  }
  try {
    const repo = await getRepo();
    const alumnos = await repo.listAlumnosByColegio(organizacion);
    return NextResponse.json({ alumnos });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

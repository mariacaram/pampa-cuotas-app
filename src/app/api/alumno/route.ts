import { NextRequest, NextResponse } from "next/server";
import { getAlumnoComputed } from "@/lib/server/service";
import { guardApi } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el parámetro id" }, { status: 400 });
  }
  try {
    const alumno = await getAlumnoComputed(id);
    if (!alumno) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ alumno });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

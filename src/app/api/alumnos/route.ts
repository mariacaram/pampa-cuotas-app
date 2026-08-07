import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";
import { getAlumnosComputed } from "@/lib/server/stats";
import { guardApi } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// Normaliza para buscar sin importar mayúsculas/acentos.
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export async function GET(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const organizacion = req.nextUrl.searchParams.get("organizacion");
  const q = req.nextUrl.searchParams.get("q");

  try {
    const repo = await getRepo();

    // Búsqueda global por nombre de alumno (sin necesidad de elegir colegio).
    if (q !== null) {
      const term = norm(q);
      if (term.length < 2) return NextResponse.json({ alumnos: [] });
      const todos = await repo.listAllAlumnos();
      const alumnos = todos
        .filter((a) => norm(a.alumno).includes(term) || norm(a.organizacion).includes(term))
        .sort((a, b) => a.alumno.localeCompare(b.alumno, "es"))
        .slice(0, 30);
      return NextResponse.json({ alumnos });
    }

    if (!organizacion) {
      return NextResponse.json({ error: "Falta el parámetro organizacion o q" }, { status: 400 });
    }
    // Ya calculado (saldo/situación EN VIVO, con los pagos de la app aplicados) — no la
    // planilla cruda, para que la lista quede consistente con la ficha de cada alumno apenas
    // se confirma un pago.
    const alumnos = (await getAlumnosComputed(organizacion)).sort((a, b) =>
      a.alumno.localeCompare(b.alumno, "es")
    );
    return NextResponse.json({ alumnos });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

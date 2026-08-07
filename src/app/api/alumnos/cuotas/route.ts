import { NextRequest, NextResponse } from "next/server";
import { getAlumnosComputed } from "@/lib/server/stats";
import { guardApi } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// Plan de cuotas de TODOS los alumnos de un colegio, liviano (solo lo necesario para armar los
// "chips" de cuota en el pago grupal — ver PagoGrupalForm/CuotasView).
export async function GET(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const organizacion = req.nextUrl.searchParams.get("organizacion");
  if (!organizacion) {
    return NextResponse.json({ error: "Falta el parámetro organizacion" }, { status: 400 });
  }
  try {
    const computados = await getAlumnosComputed(organizacion);
    const alumnos = computados.map((a) => ({
      alumno_id: a.alumno_id,
      cuotasPlan: a.cuotasPlan,
    }));
    return NextResponse.json({ alumnos });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

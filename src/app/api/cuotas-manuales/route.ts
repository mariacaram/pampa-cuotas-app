import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";
import { getAlumnoComputed } from "@/lib/server/service";
import { guardApi } from "@/lib/server/auth";
import { logAuditoria } from "@/lib/server/usuarios";
import { getCuotasManuales, setCuotasManuales, borrarCuotasManuales } from "@/lib/server/cuotasManuales";

export const dynamic = "force-dynamic";

// Trae los importes de cuota cargados a mano para un alumno (null si usa el reparto automático).
export async function GET(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const alumnoId = req.nextUrl.searchParams.get("alumno_id");
  if (!alumnoId) return NextResponse.json({ error: "Falta alumno_id" }, { status: 400 });
  try {
    const montos = await getCuotasManuales(alumnoId);
    return NextResponse.json({ montos });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Carga (o reemplaza) los importes de cuota a mano para un alumno: un número por cuota, en
// orden. total_asignado y plan_cuotas del alumno se actualizan para que queden consistentes
// con lo cargado (son columnas existentes, no un cambio de esquema).
export async function POST(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { alumno_id?: string; montos?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const alumnoId = String(body.alumno_id || "");
  const montos = Array.isArray(body.montos) ? body.montos.map((m) => Math.round(Number(m) || 0)) : [];

  if (!alumnoId) return NextResponse.json({ error: "Falta alumno_id" }, { status: 400 });
  if (montos.length === 0) {
    return NextResponse.json({ error: "Cargá al menos un importe de cuota" }, { status: 400 });
  }
  if (montos.some((m) => m <= 0)) {
    return NextResponse.json({ error: "Todos los importes deben ser mayores a 0" }, { status: 400 });
  }

  try {
    const repo = await getRepo();
    const base = await repo.getAlumnoBase(alumnoId);
    if (!base) return NextResponse.json({ error: "El alumno no existe" }, { status: 404 });

    const totalNuevo = montos.reduce((acc, m) => acc + m, 0);
    await repo.updateAlumnoTotales(alumnoId, { plan_cuotas: montos.length, total_asignado: totalNuevo });
    await setCuotasManuales(alumnoId, montos, g.usuario?.email ?? null);

    await logAuditoria(g.usuario?.email ?? null, "cargar_cuotas_manuales", alumnoId, {
      alumno: base.alumno,
      colegio: base.organizacion,
      montos,
      total_nuevo: totalNuevo,
      plan_cuotas_nuevo: montos.length,
    });

    const alumno = await getAlumnoComputed(alumnoId);
    return NextResponse.json({ ok: true, alumno });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Vuelve al reparto automático (borra los importes manuales; NO toca total_asignado/plan_cuotas,
// que quedan como estén — Paulina puede corregirlos de nuevo si hace falta).
export async function DELETE(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { alumno_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const alumnoId = String(body.alumno_id || "");
  if (!alumnoId) return NextResponse.json({ error: "Falta alumno_id" }, { status: 400 });

  try {
    await borrarCuotasManuales(alumnoId);
    await logAuditoria(g.usuario?.email ?? null, "borrar_cuotas_manuales", alumnoId, {});
    const alumno = await getAlumnoComputed(alumnoId);
    return NextResponse.json({ ok: true, alumno });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

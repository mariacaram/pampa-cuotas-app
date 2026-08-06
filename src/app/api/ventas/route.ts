import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";
import { guardApi } from "@/lib/server/auth";
import { logAuditoria } from "@/lib/server/usuarios";
import { NuevaVenta } from "@/lib/types";

export const dynamic = "force-dynamic";

// Alta de una venta nueva (nuevo alumno/orden) cargada desde la app.
export async function POST(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: Partial<NuevaVenta>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const alumno = String(body.alumno || "").trim();
  const organizacion = String(body.organizacion || "").trim();
  const total = Number(body.total_asignado);
  const plan = Math.max(1, Math.round(Number(body.plan_cuotas) || 1));

  if (!alumno) return NextResponse.json({ error: "Falta el nombre del alumno" }, { status: 400 });
  if (!organizacion) return NextResponse.json({ error: "Falta el colegio" }, { status: 400 });
  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ error: "El total debe ser mayor a 0" }, { status: 400 });
  }

  const venta: NuevaVenta = {
    alumno,
    organizacion,
    nombre_cliente: String(body.nombre_cliente || "").trim(),
    total_asignado: total,
    plan_cuotas: plan,
    forma_de_pago: String(body.forma_de_pago || "Efectivo"),
    fecha_orden: body.fecha_orden || new Date().toISOString().slice(0, 10),
  };

  try {
    const repo = await getRepo();
    const nuevo = await repo.addAlumno(venta);
    await logAuditoria(g.usuario?.email ?? null, "crear_venta", nuevo.alumno_id, {
      alumno: nuevo.alumno,
      colegio: nuevo.organizacion,
      total: nuevo.total_asignado,
      plan_cuotas: nuevo.plan_cuotas,
      forma_de_pago: nuevo.forma_de_pago,
      fecha_orden: nuevo.fecha_orden,
    });
    return NextResponse.json({ ok: true, alumno: nuevo });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

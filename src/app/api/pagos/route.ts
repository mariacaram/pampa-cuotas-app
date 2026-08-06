import { NextRequest, NextResponse } from "next/server";
import { registrarPago, getAlumnoComputed } from "@/lib/server/service";
import { getRepo } from "@/lib/server/repo";
import { NuevoPago } from "@/lib/types";
import { guardApi } from "@/lib/server/auth";
import { logAuditoria } from "@/lib/server/usuarios";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: Partial<NuevoPago>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const monto = Number(body.monto);
  if (!body.alumno_id || !Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json(
      { error: "Se requiere alumno_id y un monto mayor a 0" },
      { status: 400 }
    );
  }

  const pago: NuevoPago = {
    alumno_id: String(body.alumno_id),
    fecha: body.fecha || new Date().toISOString().slice(0, 10),
    monto,
    forma_de_pago: body.forma_de_pago || "Efectivo",
    interes: Number(body.interes) > 0 ? Number(body.interes) : 0,
    interes_pct: Number(body.interes_pct) > 0 ? Number(body.interes_pct) : 0,
    bonificacion: Number(body.bonificacion) > 0 ? Number(body.bonificacion) : 0,
    nota: body.nota || "",
  };

  try {
    const alumno = await registrarPago(pago);
    await logAuditoria(g.usuario?.email ?? null, "registrar_pago", pago.alumno_id, {
      alumno: alumno.alumno,
      colegio: alumno.organizacion,
      monto: pago.monto,
      forma_de_pago: pago.forma_de_pago,
      bonificacion: pago.bonificacion,
      interes: pago.interes,
    });
    return NextResponse.json({ alumno });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Anular (borrar) un pago cargado desde la app. Queda registrado en Auditoría
// quién lo anuló, cuándo, el detalle del pago y el motivo.
export async function DELETE(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { id?: number | string; motivo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (body.id === undefined || body.id === null || String(body.id) === "") {
    return NextResponse.json({ error: "Falta el id del pago" }, { status: 400 });
  }
  const motivo = String(body.motivo || "").trim();
  if (!motivo) {
    return NextResponse.json({ error: "Indicá el motivo de la anulación" }, { status: 400 });
  }

  try {
    const repo = await getRepo();
    const pago = await repo.getPago(body.id);
    if (!pago) return NextResponse.json({ error: "El pago no existe" }, { status: 404 });
    const base = await repo.getAlumnoBase(pago.alumno_id);

    await repo.deletePago(body.id);
    await logAuditoria(g.usuario?.email ?? null, "anular_pago", pago.alumno_id, {
      pago_id: pago.id,
      alumno: base?.alumno ?? null,
      colegio: base?.organizacion ?? null,
      monto: pago.monto,
      fecha: pago.fecha,
      forma_de_pago: pago.forma_de_pago,
      motivo,
    });

    const alumno = await getAlumnoComputed(pago.alumno_id);
    return NextResponse.json({ ok: true, alumno });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

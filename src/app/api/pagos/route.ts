import { NextRequest, NextResponse } from "next/server";
import { registrarPago } from "@/lib/server/service";
import { NuevoPago } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
    nota: body.nota || "",
  };

  try {
    const alumno = await registrarPago(pago);
    return NextResponse.json({ alumno });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

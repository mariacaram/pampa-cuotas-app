import { NextResponse } from "next/server";
import { getCurrentUsuario } from "@/lib/server/auth";
import { listAuditoria } from "@/lib/server/usuarios";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await getCurrentUsuario();
  if (!u || u.rol !== "admin" || u.estado !== "aprobado") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const registros = await listAuditoria(400);
  return NextResponse.json({ registros });
}

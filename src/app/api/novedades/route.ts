import { NextResponse } from "next/server";
import { guardApi } from "@/lib/server/auth";
import { listAuditoria } from "@/lib/server/usuarios";

export const dynamic = "force-dynamic";

// Novedades para el admin: las anulaciones de pago registradas en Auditoría, más recientes primero.
export async function GET() {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (g.usuario && g.usuario.rol !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }
  const rows = await listAuditoria(500);
  const anulaciones = rows.filter((r) => r.accion === "anular_pago");
  return NextResponse.json({ anulaciones });
}

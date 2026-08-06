import { NextRequest, NextResponse } from "next/server";
import { getCurrentUsuario } from "@/lib/server/auth";
import { listUsuarios, setEstadoUsuario, logAuditoria } from "@/lib/server/usuarios";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const u = await getCurrentUsuario();
  if (!u || u.rol !== "admin" || u.estado !== "aprobado") return null;
  return u;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const usuarios = await listUsuarios();
  return NextResponse.json({ usuarios });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").toLowerCase().trim();
  const accion = body.accion === "rechazar" ? "rechazar" : "aprobar";
  if (!email) return NextResponse.json({ error: "Falta email" }, { status: 400 });

  const estado = accion === "aprobar" ? "aprobado" : "rechazado";
  await setEstadoUsuario(email, estado, admin.email);
  await logAuditoria(admin.email, accion === "aprobar" ? "aprobar_usuario" : "rechazar_usuario", email);

  const usuarios = await listUsuarios();
  return NextResponse.json({ ok: true, usuarios });
}

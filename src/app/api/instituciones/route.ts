import { NextRequest, NextResponse } from "next/server";
import { listInstituciones, addInstitucion, TipoInstitucion } from "@/lib/server/instituciones";
import { guardApi } from "@/lib/server/auth";
import { logAuditoria } from "@/lib/server/usuarios";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const instituciones = await listInstituciones();
  return NextResponse.json({ instituciones });
}

export async function POST(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const nombre = String(body.nombre || "").trim();
  const tipoRaw = String(body.tipo || "colegio");
  const tipo: TipoInstitucion =
    tipoRaw === "club" || tipoRaw === "empresa" ? tipoRaw : "colegio";
  const referenteNombre = String(body.referente_nombre || "").trim();
  const referenteApellido = String(body.referente_apellido || "").trim();

  if (!nombre) return NextResponse.json({ error: "Falta el nombre de la institución" }, { status: 400 });
  if (!referenteNombre || !referenteApellido) {
    return NextResponse.json({ error: "Falta el nombre y apellido del referente" }, { status: 400 });
  }

  try {
    const inst = await addInstitucion({
      nombre,
      tipo,
      referente_nombre: referenteNombre,
      referente_apellido: referenteApellido,
      contacto: String(body.contacto || "").trim(),
      creadoPor: g.usuario?.email ?? null,
    });
    await logAuditoria(g.usuario?.email ?? null, "crear_institucion", inst.nombre, {
      tipo: inst.tipo,
      referente: `${inst.referente_nombre} ${inst.referente_apellido}`,
      contacto: inst.contacto,
    });
    return NextResponse.json({ ok: true, institucion: inst });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

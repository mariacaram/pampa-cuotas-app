import { NextRequest, NextResponse } from "next/server";
import { buildExportBuffer, buildColegioReportBuffer } from "@/lib/server/exportXlsx";
import { guardApi } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// Nombre de archivo seguro (sin acentos ni caracteres raros).
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

export async function GET(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const organizacion = req.nextUrl.searchParams.get("organizacion") || undefined;
  const fecha = new Date().toISOString().slice(0, 10);
  try {
    const buffer = organizacion
      ? await buildColegioReportBuffer(organizacion)
      : await buildExportBuffer();
    const filename = organizacion
      ? `reporte-${slug(organizacion)}-${fecha}.xlsx`
      : `pampa-cuotas-${fecha}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

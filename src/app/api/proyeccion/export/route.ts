import { NextRequest, NextResponse } from "next/server";
import { buildProyeccionXlsx, buildProyeccionPdf } from "@/lib/server/proyeccionExport";
import { guardApi } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 50);
}

export async function GET(req: NextRequest) {
  const g = await guardApi();
  if (!g.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const organizacion = req.nextUrl.searchParams.get("organizacion") || undefined;
  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const modoParam = req.nextUrl.searchParams.get("modo");
  const modo = modoParam === "atrasado" || modoParam === "esteMes" ? modoParam : "todos";
  const fecha = new Date().toISOString().slice(0, 10);
  const base = `saldo-pendiente${modo !== "todos" ? "-" + modo : ""}${organizacion ? "-" + slug(organizacion) : ""}-${fecha}`;

  try {
    if (format === "pdf") {
      const buffer = await buildProyeccionPdf(organizacion, modo);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${base}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const buffer = await buildProyeccionXlsx(organizacion, modo);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

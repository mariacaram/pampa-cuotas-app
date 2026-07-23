import { NextRequest, NextResponse } from "next/server";
import { buildPendienteXlsx, buildPendientePdf } from "@/lib/server/pendienteExport";

export const dynamic = "force-dynamic";

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
  const organizacion = req.nextUrl.searchParams.get("organizacion") || undefined;
  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const fecha = new Date().toISOString().slice(0, 10);
  const base = organizacion ? `pendiente-${slug(organizacion)}` : "pendiente-todos";

  try {
    if (format === "pdf") {
      const buffer = await buildPendientePdf(organizacion);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${base}-${fecha}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const buffer = await buildPendienteXlsx(organizacion);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}-${fecha}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { buildCajaXlsx, buildCajaPdf } from "@/lib/server/cajaExport";

export const dynamic = "force-dynamic";

function defaultRange() {
  const now = new Date();
  return {
    desde: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    hasta: now.toISOString().slice(0, 10),
  };
}

export async function GET(req: NextRequest) {
  const def = defaultRange();
  const desde = req.nextUrl.searchParams.get("desde") || def.desde;
  const hasta = req.nextUrl.searchParams.get("hasta") || def.hasta;
  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const base = `caja-${desde}_a_${hasta}`;

  try {
    if (format === "pdf") {
      const buffer = await buildCajaPdf(desde, hasta);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${base}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const buffer = await buildCajaXlsx(desde, hasta);
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

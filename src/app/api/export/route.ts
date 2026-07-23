import { NextResponse } from "next/server";
import { buildExportBuffer } from "@/lib/server/exportXlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const buffer = await buildExportBuffer();
    const fecha = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="pampa-cuotas-${fecha}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

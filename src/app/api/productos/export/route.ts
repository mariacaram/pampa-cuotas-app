import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getProductos } from "@/lib/server/productos";

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
  const organizacion = req.nextUrl.searchParams.get("organizacion") || undefined;
  try {
    const p = await getProductos(organizacion);
    const prod = [
      ["Producto", "Pedidos", "Facturación aprox."],
      ...p.porProducto.map((x) => [x.producto, x.pedidos, Math.round(x.facturacion)]),
    ];
    const combos = [
      ["Combo", "Pedidos"],
      ...p.topCombos.map((x) => [x.combo, x.pedidos]),
    ];
    const wb = XLSX.utils.book_new();
    const w1 = XLSX.utils.aoa_to_sheet(prod);
    w1["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, w1, "Por producto");
    const w2 = XLSX.utils.aoa_to_sheet(combos);
    w2["!cols"] = [{ wch: 40 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, w2, "Combos");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const fecha = new Date().toISOString().slice(0, 10);
    const name = organizacion ? `productos-${slug(organizacion)}-${fecha}` : `productos-${fecha}`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

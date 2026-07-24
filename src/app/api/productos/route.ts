import { NextRequest, NextResponse } from "next/server";
import { getProductos } from "@/lib/server/productos";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const organizacion = req.nextUrl.searchParams.get("organizacion") || undefined;
  try {
    const productos = await getProductos(organizacion);
    return NextResponse.json({ productos });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

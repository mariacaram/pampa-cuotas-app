import "server-only";
import { getRepo } from "./repo";
import { AlumnoBase } from "@/lib/types";

export type ProductoStat = { producto: string; pedidos: number; facturacion: number };
export type ComboStat = { combo: string; pedidos: number };
export type ComboOficial = { combo: string; nombre: string; pedidos: number; facturacion: number };
export type Productos = {
  scope: string;
  totalPedidos: number;
  porProducto: ProductoStat[];
  topCombos: ComboStat[];
  porCombo: ComboOficial[];
};

// Combos oficiales del flyer (Canguro = BUZO en los datos).
const COMBOS_OFICIALES: Record<string, string> = {
  "1": "Combo 1 · Canguro + Chomba",
  "2": "Combo 2 · Campera + Chomba",
  "3": "Combo 3 · Canguro + Chomba + Babucha",
  "4": "Combo 4 · Campera + Chomba + Babucha",
  otros: "Otros / fuera de combo",
};

function comboOficialDe(prendas: string[]): string {
  const s = new Set(prendas);
  const buzo = s.has("BUZO");
  const camp = s.has("CAMPERAS");
  const bab = s.has("BABUCHA");
  const chom = s.has("CHOMBA");
  if (chom && buzo && !camp && !bab) return "1";
  if (chom && camp && !buzo && !bab) return "2";
  if (chom && buzo && bab && !camp) return "3";
  if (chom && camp && bab && !buzo) return "4";
  return "otros";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Prendas de un pedido (producto1/2/3), normalizadas y sin vacíos / "s/t".
function prendasDe(a: AlumnoBase): string[] {
  return [a.producto1, a.producto2, a.producto3]
    .map((p) => (p ?? "").trim().toUpperCase())
    .filter((p) => p && p !== "S/T" && p !== "NONE");
}

export async function getProductos(organizacion?: string): Promise<Productos> {
  const repo = await getRepo();
  const alumnos = await repo.listAllAlumnos();
  const filtered = organizacion
    ? alumnos.filter((a) => a.organizacion === organizacion)
    : alumnos;

  const prodPedidos = new Map<string, number>();
  const prodFact = new Map<string, number>();
  const combos = new Map<string, number>();
  const comboPedidos = new Map<string, number>();
  const comboFact = new Map<string, number>();

  for (const a of filtered) {
    const prendas = prendasDe(a);
    for (const p of prendas) {
      prodPedidos.set(p, (prodPedidos.get(p) ?? 0) + 1);
      const parte = prendas.length > 0 ? (a.total_asignado || 0) / prendas.length : 0;
      prodFact.set(p, (prodFact.get(p) ?? 0) + parte);
    }
    const combo = (a.productos ?? "").trim();
    if (combo) combos.set(combo, (combos.get(combo) ?? 0) + 1);

    // Combo oficial del flyer (por productos).
    const co = comboOficialDe(prendas);
    comboPedidos.set(co, (comboPedidos.get(co) ?? 0) + 1);
    comboFact.set(co, (comboFact.get(co) ?? 0) + (a.total_asignado || 0));
  }

  const porProducto = [...prodPedidos.entries()]
    .map(([producto, pedidos]) => ({
      producto,
      pedidos,
      facturacion: round2(prodFact.get(producto) ?? 0),
    }))
    .sort((a, b) => b.pedidos - a.pedidos);

  const topCombos = [...combos.entries()]
    .map(([combo, pedidos]) => ({ combo, pedidos }))
    .sort((a, b) => b.pedidos - a.pedidos)
    .slice(0, 12);

  const orden = ["1", "2", "3", "4", "otros"];
  const porCombo = orden
    .filter((k) => (comboPedidos.get(k) ?? 0) > 0)
    .map((k) => ({
      combo: k,
      nombre: COMBOS_OFICIALES[k],
      pedidos: comboPedidos.get(k) ?? 0,
      facturacion: round2(comboFact.get(k) ?? 0),
    }));

  return {
    scope: organizacion || "Todos los colegios",
    totalPedidos: filtered.length,
    porProducto,
    topCombos,
    porCombo,
  };
}

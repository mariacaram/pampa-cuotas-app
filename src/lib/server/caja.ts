import "server-only";
import { getRepo } from "./repo";

export type CajaMedio = { forma: string; cantidad: number; monto: number };
export type CajaPago = {
  fecha: string;
  alumno: string;
  colegio: string;
  monto: number;
  forma_de_pago: string;
  interes: number;
  bonificacion: number;
  nota: string;
};
export type Caja = {
  desde: string;
  hasta: string;
  cantidadPagos: number;
  totalCobrado: number;
  totalInteres: number;
  totalBonificado: number;
  porMedio: CajaMedio[];
  pagos: CajaPago[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Control de caja: todos los pagos cargados en la app dentro del rango [desde, hasta].
export async function getCaja(desde: string, hasta: string): Promise<Caja> {
  const repo = await getRepo();
  const [alumnos, pagos] = await Promise.all([repo.listAllAlumnos(), repo.listAllPagos()]);
  const nombre = new Map(alumnos.map((a) => [a.alumno_id, a]));

  const enRango = pagos.filter((p) => p.fecha >= desde && p.fecha <= hasta);

  let totalCobrado = 0;
  let totalInteres = 0;
  let totalBonificado = 0;
  const medioMap = new Map<string, CajaMedio>();

  for (const p of enRango) {
    totalCobrado += p.monto || 0;
    totalInteres += p.interes || 0;
    totalBonificado += p.bonificacion || 0;
    const forma = (p.forma_de_pago || "Sin especificar").trim();
    const m = medioMap.get(forma) ?? { forma, cantidad: 0, monto: 0 };
    m.cantidad += 1;
    m.monto += p.monto || 0;
    medioMap.set(forma, m);
  }

  const porMedio = [...medioMap.values()]
    .map((m) => ({ ...m, monto: round2(m.monto) }))
    .sort((a, b) => b.monto - a.monto);

  const lista: CajaPago[] = enRango
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.creado_en).localeCompare(String(b.creado_en)))
    .map((p) => {
      const a = nombre.get(p.alumno_id);
      return {
        fecha: p.fecha,
        alumno: a?.alumno ?? "(alumno no encontrado)",
        colegio: a?.organizacion ?? "",
        monto: p.monto,
        forma_de_pago: p.forma_de_pago,
        interes: p.interes,
        bonificacion: p.bonificacion,
        nota: p.nota,
      };
    });

  return {
    desde,
    hasta,
    cantidadPagos: enRango.length,
    totalCobrado: round2(totalCobrado),
    totalInteres: round2(totalInteres),
    totalBonificado: round2(totalBonificado),
    porMedio,
    pagos: lista,
  };
}

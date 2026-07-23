import "server-only";
import { computeAlumno } from "@/lib/compute";
import { AlumnoComputed, Pago } from "@/lib/types";
import { getRepo } from "./repo";

export type Stats = {
  scope: string; // "Todos los colegios" o el nombre del colegio
  totalAlumnos: number;
  totalAsignado: number;
  totalCobrado: number;
  saldoPendiente: number;
  pctCobrado: number;
  situacion: { PAGO_TOTAL: number; PAGO_PARCIAL: number; SIN_PAGOS: number };
  topColegiosPorSaldo: { organizacion: string; saldo: number; alumnos: number }[];
  formasDePago: { forma: string; cantidad: number }[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Devuelve todos los alumnos ya computados (base + pagos), opcionalmente filtrados por colegio.
export async function getAlumnosComputed(organizacion?: string): Promise<AlumnoComputed[]> {
  const repo = await getRepo();
  const [alumnos, pagos] = await Promise.all([repo.listAllAlumnos(), repo.listAllPagos()]);

  const pagosPorAlumno = new Map<string, Pago[]>();
  for (const p of pagos) {
    const arr = pagosPorAlumno.get(p.alumno_id) ?? [];
    arr.push(p);
    pagosPorAlumno.set(p.alumno_id, arr);
  }

  const filtered = organizacion
    ? alumnos.filter((a) => a.organizacion === organizacion)
    : alumnos;

  return filtered.map((a) => computeAlumno(a, pagosPorAlumno.get(a.alumno_id) ?? []));
}

export async function getStats(organizacion?: string): Promise<Stats> {
  const computed = await getAlumnosComputed(organizacion);

  let totalAsignado = 0;
  let totalCobrado = 0;
  let saldoPendiente = 0;
  const situacion = { PAGO_TOTAL: 0, PAGO_PARCIAL: 0, SIN_PAGOS: 0 };
  const saldoPorColegio = new Map<string, { saldo: number; alumnos: number }>();
  const formaCount = new Map<string, number>();

  for (const a of computed) {
    totalAsignado += a.total_asignado;
    totalCobrado += a.montoPagadoTotal;
    saldoPendiente += a.saldo;

    if (a.situacion === "PAGO TOTAL") situacion.PAGO_TOTAL++;
    else if (a.situacion === "PAGO PARCIAL") situacion.PAGO_PARCIAL++;
    else situacion.SIN_PAGOS++;

    const c = saldoPorColegio.get(a.organizacion) ?? { saldo: 0, alumnos: 0 };
    c.saldo += a.saldo;
    c.alumnos += 1;
    saldoPorColegio.set(a.organizacion, c);

    const forma = (a.forma_de_pago || "Sin especificar").trim();
    formaCount.set(forma, (formaCount.get(forma) ?? 0) + 1);
  }

  const topColegiosPorSaldo = [...saldoPorColegio.entries()]
    .map(([organizacion, v]) => ({ organizacion, saldo: round2(v.saldo), alumnos: v.alumnos }))
    .filter((c) => c.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 10);

  const formasDePago = [...formaCount.entries()]
    .map(([forma, cantidad]) => ({ forma, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 8);

  return {
    scope: organizacion || "Todos los colegios",
    totalAlumnos: computed.length,
    totalAsignado: round2(totalAsignado),
    totalCobrado: round2(totalCobrado),
    saldoPendiente: round2(saldoPendiente),
    pctCobrado: totalAsignado > 0 ? Math.round((totalCobrado / totalAsignado) * 100) : 0,
    situacion,
    topColegiosPorSaldo,
    formasDePago,
  };
}

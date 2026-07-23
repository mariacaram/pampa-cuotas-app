import { Alumno } from "./types";

export type AlumnoCalc = {
  saldo: number;
  montoCuota: number;
  cuotasPagadas: number;
  cuotasPendientes: number;
  totalAPagar: number;
  estado: "Pagado" | "Atrasado" | "Pendiente";
};

export function calcularAlumno(a: Alumno): AlumnoCalc {
  const saldo = Math.max(0, round2(a.precioTotal - a.pagado));
  const cuotas = a.cuotasPactadas > 0 ? a.cuotasPactadas : 1;
  const montoCuota = a.precioTotal > 0 ? round2(a.precioTotal / cuotas) : 0;
  const cuotasPagadas =
    montoCuota > 0 ? Math.min(cuotas, Math.round(a.pagado / montoCuota)) : 0;
  const cuotasPendientes = Math.max(0, cuotas - cuotasPagadas);
  const interesAplicado = a.atrasado ? a.interes || 0 : 0;
  const totalAPagar = round2(saldo + interesAplicado);

  let estado: AlumnoCalc["estado"] = "Pendiente";
  if (saldo <= 0) estado = "Pagado";
  else if (a.atrasado) estado = "Atrasado";

  return { saldo, montoCuota, cuotasPagadas, cuotasPendientes, totalAPagar, estado };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

import { AlumnoBase, AlumnoComputed, Pago, Situacion } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Recalcula los totales de un alumno a partir de sus datos base + los pagos nuevos.
export function computeAlumno(base: AlumnoBase, pagos: Pago[]): AlumnoComputed {
  const sumaPagos = pagos.reduce((acc, p) => acc + (p.monto || 0), 0);
  const interesTotal = pagos.reduce((acc, p) => acc + (p.interes || 0), 0);
  const montoPagadoTotal = round2(base.monto_pagado_base + sumaPagos);

  const saldo = Math.max(0, round2(base.total_asignado - montoPagadoTotal));

  const cuotas = base.plan_cuotas > 0 ? base.plan_cuotas : 1;
  const montoCuota = base.total_asignado > 0 ? round2(base.total_asignado / cuotas) : 0;
  const cuotasPagadas =
    montoCuota > 0 ? Math.min(cuotas, Math.floor(montoPagadoTotal / montoCuota)) : 0;
  const cuotasPendientes = Math.max(0, cuotas - cuotasPagadas);

  let situacion: Situacion = "PAGO PARCIAL";
  if (montoPagadoTotal <= 0) situacion = "SIN PAGOS";
  else if (saldo <= 0) situacion = "PAGO TOTAL";

  return {
    ...base,
    pagos,
    montoPagadoTotal,
    interesTotal,
    saldo,
    montoCuota,
    cuotasPagadas,
    cuotasPendientes,
    situacion,
  };
}

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

  // Atraso ESTIMADO: la planilla no trae vencimientos por cuota, así que asumimos
  // 1 cuota por mes desde la fecha de la orden (la 1ª vence el mes de la orden).
  // cuotasEsperadas = cuántas ya deberían estar pagas a hoy. Si pagó menos, está atrasado.
  const cuotasEsperadas = mesesDesde(base.fecha_orden, cuotas);
  const cuotasAtrasadas = saldo > 0 ? Math.max(0, cuotasEsperadas - cuotasPagadas) : 0;
  const atrasado = cuotasAtrasadas > 0;
  const montoVencido = atrasado ? Math.min(saldo, round2(cuotasAtrasadas * montoCuota)) : 0;

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
    cuotasEsperadas,
    cuotasAtrasadas,
    atrasado,
    montoVencido,
  };
}

// Cuántas cuotas deberían estar pagas hoy, asumiendo 1 por mes desde la fecha de la orden.
function mesesDesde(fechaOrden: string, planCuotas: number): number {
  if (!fechaOrden) return 0;
  const d = new Date(fechaOrden.length <= 10 ? fechaOrden + "T00:00:00" : fechaOrden);
  if (isNaN(d.getTime())) return 0;
  const hoy = new Date();
  const meses =
    (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth());
  // +1 porque la primera cuota se considera vencida el mismo mes de la orden.
  return Math.max(0, Math.min(planCuotas, meses + 1));
}

import { AlumnoBase, AlumnoComputed, Pago, Situacion } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const SENA_DEFAULT = 10000;
// Hasta este monto, el primer pago se considera la seña (contempla señas con un extra).
// Un primer pago mayor se toma como un anticipo, no como la seña.
const SENA_TOPE = 25000;

// La seña es el primer pago del pedido. Normalmente 10.000, pero puede ser mayor si el
// pedido tenía un extra (ej. camiseta). Solo la deducimos del primer pago cuando es un
// monto "chico" (<= SENA_TOPE); un primer pago grande es un anticipo, no la seña.
function detectarSena(base: AlumnoBase): number {
  if (
    base.cuotas_pagadas_base === 1 &&
    base.monto_pagado_base > 0 &&
    base.monto_pagado_base <= SENA_TOPE
  ) {
    return base.monto_pagado_base;
  }
  return SENA_DEFAULT;
}

// Monto de cada cuota regular (la que se muestra en el plan de pagos), según el flyer.
//  - plan_cuotas <= 1  -> pago al contado: la "cuota" es el total.
//  - plan_cuotas >= 5  -> plan más largo que el flyer: todas las cuotas iguales (total / n).
//  - plan_cuotas 2-4   -> promo del flyer: (total - seña) repartido entre las cuotas reales.
// OJO: en la planilla, plan_cuotas cuenta la seña como la 1ª cuota, así que las cuotas
// reales (después de la seña) son plan_cuotas - 1. El total ya trae incorporado el precio
// del combo y el recargo de abril/julio, por eso no hace falta identificarlos acá.
function montoCuotaRegular(base: AlumnoBase): number {
  const total = base.total_asignado;
  if (total <= 0) return 0;
  const plan = base.plan_cuotas > 0 ? base.plan_cuotas : 1;
  if (plan <= 1) return round2(total);
  if (plan >= 5) return round2(total / plan);
  const sena = detectarSena(base);
  return round2((total - sena) / (plan - 1));
}

// Recalcula los totales de un alumno a partir de sus datos base + los pagos nuevos.
export function computeAlumno(base: AlumnoBase, pagos: Pago[]): AlumnoComputed {
  const sumaPagos = pagos.reduce((acc, p) => acc + (p.monto || 0), 0);
  const interesTotal = pagos.reduce((acc, p) => acc + (p.interes || 0), 0);
  const bonificacionTotal = pagos.reduce((acc, p) => acc + (p.bonificacion || 0), 0);
  const montoPagadoTotal = round2(base.monto_pagado_base + sumaPagos);

  const saldo = Math.max(0, round2(base.total_asignado - montoPagadoTotal));

  const cuotas = base.plan_cuotas > 0 ? base.plan_cuotas : 1;
  const montoCuota = montoCuotaRegular(base);
  // Cuotas pagadas = las que ya trae la planilla (cuotas_pagadas_base, que YA cuenta la seña
  // variable como 1ª cuota) + las cubiertas por los pagos NUEVOS de la app (por monto).
  // Si el saldo quedó en 0, se considera todo pagado.
  const cuotasPagadasNuevas = montoCuota > 0 ? Math.floor(sumaPagos / montoCuota) : 0;
  const cuotasPagadas =
    saldo <= 0
      ? cuotas
      : Math.min(cuotas, (base.cuotas_pagadas_base || 0) + cuotasPagadasNuevas);
  const cuotasPendientes = Math.max(0, cuotas - cuotasPagadas);

  let situacion: Situacion = "PAGO PARCIAL";
  if (montoPagadoTotal <= 0) situacion = "SIN PAGOS";
  else if (saldo <= 0) situacion = "PAGO TOTAL";

  // Atraso según los vencimientos reales del negocio:
  //  - 1ª cuota: vence a FIN del mes de la fecha_orden.
  //  - 2ª, 3ª, …: vencen el 15 de cada mes siguiente.
  // cuotasEsperadas = cuántas ya vencieron a hoy. Si pagó menos, está atrasado.
  const cuotasEsperadas = cuotasVencidasHoy(base.fecha_orden, cuotas);
  const cuotasAtrasadas = saldo > 0 ? Math.max(0, cuotasEsperadas - cuotasPagadas) : 0;
  const atrasado = cuotasAtrasadas > 0;
  const montoVencido = atrasado ? Math.min(saldo, round2(cuotasAtrasadas * montoCuota)) : 0;

  // Próxima cuota impaga = (cuotasPagadas + 1); su vencimiento. "" si ya está saldado.
  let proximoVencimiento = "";
  if (saldo > 0 && cuotasPendientes > 0 && base.fecha_orden) {
    const d = new Date(base.fecha_orden.length <= 10 ? base.fecha_orden + "T00:00:00" : base.fecha_orden);
    if (!isNaN(d.getTime())) {
      const venc = vencimientoCuota(d, Math.min(cuotas, cuotasPagadas + 1));
      proximoVencimiento = `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, "0")}-${String(venc.getDate()).padStart(2, "0")}`;
    }
  }

  return {
    ...base,
    pagos,
    montoPagadoTotal,
    interesTotal,
    bonificacionTotal,
    saldo,
    montoCuota,
    cuotasPagadas,
    cuotasPendientes,
    situacion,
    cuotasEsperadas,
    cuotasAtrasadas,
    atrasado,
    montoVencido,
    proximoVencimiento,
  };
}

// Fecha de vencimiento de la cuota k (1-based):
//  - k = 1: último día del mes de la fecha_orden.
//  - k >= 2: día 15 del mes (mes_orden + (k-1)).
function vencimientoCuota(orden: Date, k: number): Date {
  const year = orden.getFullYear();
  const month = orden.getMonth(); // 0-based
  if (k <= 1) {
    // Día 0 del mes siguiente = último día del mes de la orden.
    return new Date(year, month + 1, 0, 23, 59, 59, 999);
  }
  return new Date(year, month + (k - 1), 15, 23, 59, 59, 999);
}

// Cuántas cuotas ya vencieron a hoy (según los vencimientos del negocio), tope = planCuotas.
function cuotasVencidasHoy(fechaOrden: string, planCuotas: number): number {
  if (!fechaOrden) return 0;
  const d = new Date(fechaOrden.length <= 10 ? fechaOrden + "T00:00:00" : fechaOrden);
  if (isNaN(d.getTime())) return 0;
  const hoy = new Date();
  let vencidas = 0;
  for (let k = 1; k <= planCuotas; k++) {
    if (vencimientoCuota(d, k).getTime() <= hoy.getTime()) vencidas++;
    else break; // los vencimientos son crecientes
  }
  return vencidas;
}

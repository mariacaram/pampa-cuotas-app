import { AlumnoBase, AlumnoComputed, CuotaPlan, Pago, Situacion } from "./types";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const SENA_DEFAULT = 10000;
// Hasta este monto, el primer pago se considera la seña (contempla señas con un extra).
// Un primer pago mayor se toma como un anticipo, no como la seña.
const SENA_TOPE = 25000;

// La seña es el primer pago del pedido. Por defecto 10.000. Si el pedido pagó SOLO la seña
// (cuotas_pagadas_base === 1), la tomamos de lo pagado (con tope 25k para datos importados;
// sin tope para ventas de la app, donde la seña la fija el usuario). NO se usan precios de flyer.
function detectarSena(base: AlumnoBase): number {
  const esApp = (base.nro_orden || "").startsWith("APP-");
  if (base.cuotas_pagadas_base === 1 && base.monto_pagado_base > 0) {
    if (esApp) return base.monto_pagado_base;
    if (base.monto_pagado_base <= SENA_TOPE) return base.monto_pagado_base;
  }
  return SENA_DEFAULT;
}

// Monto de la cuota regular (la que se repite en el plan): reparto PAREJO.
//  - plan_cuotas <= 1  -> contado: la "cuota" es el total.
//  - plan_cuotas >= 5  -> cuotas iguales (total / n).
//  - plan_cuotas 2-4   -> lo que queda después de la seña, repartido en partes iguales entre
//    las cuotas reales: (total − seña) / (plan − 1). NO se usan precios de flyer acá.
// OJO: plan_cuotas cuenta la seña como 1ª cuota, así que las cuotas reales son plan_cuotas - 1.
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

  // Plan de cuotas mes por mes: fecha de vencimiento + estado (pagada/vencida/pendiente).
  const cuotasPlan = buildCuotasPlan(base, cuotas, montoCuota, cuotasPagadas);

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
    cuotasPlan,
  };
}

// Arma el detalle de cada cuota: número, vencimiento y estado.
//  - pagada:   ya cubierta (numero <= cuotasPagadas).
//  - vencida:  no pagada y su vencimiento ya pasó.
//  - pendiente: no pagada y todavía no vence.
function buildCuotasPlan(
  base: AlumnoBase,
  cuotas: number,
  montoCuota: number,
  cuotasPagadas: number
): CuotaPlan[] {
  const plan: CuotaPlan[] = [];
  const d = base.fecha_orden
    ? new Date(base.fecha_orden.length <= 10 ? base.fecha_orden + "T00:00:00" : base.fecha_orden)
    : null;
  const ordenValida = d && !isNaN(d.getTime());
  const hoy = Date.now();
  const sena = detectarSena(base);
  const total = base.total_asignado;
  for (let k = 1; k <= cuotas; k++) {
    const venc = ordenValida ? vencimientoCuota(d as Date, k) : null;
    let estado: CuotaPlan["estado"];
    if (k <= cuotasPagadas) estado = "pagada";
    else if (venc && venc.getTime() <= hoy) estado = "vencida";
    else estado = "pendiente";
    // Reparto PAREJO del plan (todas las cuotas reales iguales; suman EXACTO el total):
    //  - contado (1 cuota): la cuota es el total.
    //  - plan largo (>=5): todas iguales (la última absorbe el redondeo).
    //  - plan 2-4: 1ª = seña; el resto = (total − seña)/(plan−1) parejo (la última absorbe
    //    cualquier redondeo, para que la suma cierre exacta).
    let monto: number;
    if (cuotas <= 1) monto = total;
    else if (base.plan_cuotas >= 5) monto = k < cuotas ? montoCuota : round2(total - montoCuota * (cuotas - 1));
    else if (k === 1) monto = sena;
    else if (k === cuotas) monto = round2(total - sena - montoCuota * (cuotas - 2));
    else monto = montoCuota;
    monto = Math.max(0, round2(monto));
    plan.push({
      numero: k,
      vencimiento: venc ? isoDate(venc) : "",
      monto,
      estado,
    });
  }
  return plan;
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

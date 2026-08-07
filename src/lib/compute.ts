import { AlumnoBase, AlumnoComputed, CuotaPlan, Pago, Situacion } from "./types";
import { PRECIOS_COLEGIO } from "./preciosColegio";

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

// Colegios con arreglo / precio ESPECIAL (negociado aparte): NO usan la lista del flyer.
// Para ellos la cuota se reparte parejo: (total − seña) / cuotas reales.
// Agregá acá el nombre EXACTO del colegio (como figura en organizacion) para sumar excepciones.
const COLEGIOS_ESPECIALES = new Set<string>([
  "santa rosa",
  "27 nueva concepcion",
  "27 maria del rosario",
  "27 santa cruz",
  "27 san matias",
  "27 abejita",
]);
function esColegioEspecial(base: AlumnoBase): boolean {
  return COLEGIOS_ESPECIALES.has((base.organizacion || "").trim().toLowerCase());
}

// Precios del flyer: monto de CADA cuota, por combo y cantidad de cuotas reales (Opción 1/2/3).
// Hay dos listas porque los precios cambiaron: los pedidos desde el 1/7/2026 usan JULIO;
// los anteriores, ABRIL.
const FLYER_JULIO = {
  C1: { 1: 95000, 2: 54000, 3: 43000 },
  C2: { 1: 108000, 2: 61000, 3: 52000 },
  C3: { 1: 132000, 2: 74000, 3: 59000 },
  C4: { 1: 145000, 2: 78000, 3: 64000 },
} as const;
const FLYER_ABRIL = {
  C1: { 1: 95000, 2: 49000, 3: 38000 },
  C2: { 1: 108000, 2: 56000, 3: 47000 },
  C3: { 1: 132000, 2: 69000, 3: 54000 },
  C4: { 1: 145000, 2: 73000, 3: 59000 },
} as const;
type ComboId = "C1" | "C2" | "C3" | "C4";

// Identifica el combo del flyer a partir de los productos del pedido:
//   C1 = buzo + chomba          C2 = campera + chomba
//   C3 = buzo + chomba + babucha  C4 = campera + chomba + babucha
// Si el pedido tiene extras (camiseta, bandera, etc.) o productos incompletos, devuelve
// null (no es un combo "limpio" del flyer) y el cálculo cae al reparto parejo.
function comboDe(base: AlumnoBase): ComboId | null {
  const items = [base.producto1, base.producto2, base.producto3].map((p) => (p || "").toUpperCase());
  const has = (w: string) => items.some((x) => x.includes(w));
  if (has("CAMISETA") || has("BANDERA") || has("EXTRA") || has("CHALECO") || has("DEPORTE")) {
    return null;
  }
  const buzo = has("BUZO");
  const campera = has("CAMPERA");
  const chomba = has("CHOMBA");
  const babucha = has("BABUCHA");
  if (buzo && chomba && !campera && !babucha) return "C1";
  if (campera && chomba && !buzo && !babucha) return "C2";
  if (buzo && chomba && babucha && !campera) return "C3";
  if (campera && chomba && babucha && !buzo) return "C4";
  return null;
}

// Montos de cuota candidatos para el combo/período/nº de cuotas, en orden de prioridad:
// primero el precio REAL del colegio (PRECIOS_COLEGIO — solo existe cuando ese precio es MENOR
// al mínimo del flyer para el combo, es decir, un precio genuinamente distinto y negociado
// aparte), después el flyer nacional. Nunca se guarda un precio de colegio que sea igual o mayor
// al flyer: eso sería "flyer + un extra que compró la mayoría del grupo", y el extra SIEMPRE va
// entero en la última cuota, nunca promediado entre todas (regla de Paulina).
function cuotasCandidatas(base: AlumnoBase, nCuotas: number): number[] {
  const combo = comboDe(base);
  if (!combo || nCuotas < 1 || nCuotas > 3) return [];
  const esJulio = !!base.fecha_orden && base.fecha_orden >= "2026-07-01";
  const periodo = esJulio ? "J" : "A";
  const key = `${(base.organizacion || "").trim().toLowerCase()}|||${combo}|||${periodo}|||${nCuotas}`;
  const local = PRECIOS_COLEGIO[key];
  const nacional = (esJulio ? FLYER_JULIO : FLYER_ABRIL)[combo][nCuotas as 1 | 2 | 3];
  const candidatos = local !== undefined ? [local, nacional] : [nacional];
  return [...new Set(candidatos)];
}

// La seña es el primer pago del pedido. Normalmente 10.000, pero puede ser mayor si el
// pedido tenía un extra (el extra a veces se cobra en la seña, no en una cuota).
// La deducimos de lo REALMENTE pagado, para no adivinar dónde quedó el extra:
//   seña = pagado − (cuotas reales ya pagadas × cuota del flyer)
// Ej: pagó 96.000 en 3 cuotas de un Combo1 abril (cuota 38.000) → seña = 96.000 − 38.000×2 = 20.000.
function detectarSena(base: AlumnoBase): number {
  // Ventas cargadas desde la app (nro_orden "APP-…"): la seña la fijó el usuario,
  // así que la tomamos exacta (sin el tope, que es solo para datos importados).
  const esApp = (base.nro_orden || "").startsWith("APP-");
  const pagadas = base.cuotas_pagadas_base;
  const pagado = base.monto_pagado_base;
  if (pagadas >= 1 && pagado > 0) {
    // Deducir la seña de lo pagado con el precio del flyer (solo colegios NO especiales):
    // descuenta las cuotas reales ya cobradas y lo que queda es la seña real.
    if (!esColegioEspecial(base)) {
      const nReales = (base.plan_cuotas > 0 ? base.plan_cuotas : 1) - 1;
      if (nReales >= 1) {
        for (const fc of cuotasCandidatas(base, nReales)) {
          const realesPagadas = Math.min(pagadas - 1, nReales);
          const inferida = round2(pagado - fc * realesPagadas);
          if (inferida > 0 && inferida <= base.total_asignado) return inferida;
        }
      }
    }
    // Fallback: si solo se pagó la seña, la tomamos directa (con tope para importados).
    if (pagadas === 1) {
      if (esApp) return pagado;
      if (pagado <= SENA_TOPE) return pagado;
    }
  }
  return SENA_DEFAULT;
}

// Monto de la cuota regular (la que se repite en el plan). Prioriza el precio del flyer:
//  - plan_cuotas <= 1  -> contado: la "cuota" es el total.
//  - plan_cuotas >= 5  -> plan más largo que el flyer: cuotas iguales (total / n).
//  - plan_cuotas 2-4   -> si el combo es identificable y el total alcanza, se usa la cuota
//    EXACTA del flyer (el extra que sobra se cobra entero en la última cuota, nunca repartido).
//    Si no hay combo (extras/incompletos) o el total no alcanza, se reparte lo que queda tras
//    la seña en partes iguales (fallback seguro que siempre cierra con el total).
// OJO: plan_cuotas cuenta la seña como 1ª cuota, así que las cuotas reales son plan_cuotas - 1.
function montoCuotaRegular(base: AlumnoBase): number {
  const total = base.total_asignado;
  if (total <= 0) return 0;
  const plan = base.plan_cuotas > 0 ? base.plan_cuotas : 1;
  if (plan <= 1) return round2(total);
  if (plan >= 5) return round2(total / plan);
  const sena = detectarSena(base);
  const nReales = plan - 1;
  // Colegios especiales: reparto parejo, sin flyer/precio de colegio.
  if (!esColegioEspecial(base)) {
    // Probamos cada candidato (precio de colegio primero, nacional después) y usamos el
    // primero que el total alcance a cubrir (extra >= 0); si ninguno encaja, parejo.
    for (const fc of cuotasCandidatas(base, nReales)) {
      if (total >= sena + fc * nReales) return fc;
    }
  }
  return round2((total - sena) / nReales);
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
    // Reparto del plan (el extra NUNCA se reparte: va entero en la última cuota):
    //  - contado (1 cuota): la cuota es el total.
    //  - plan largo (>=5): todas iguales (la última absorbe el redondeo).
    //  - plan 2-4: 1ª = seña; intermedias = cuota del flyer (montoCuota); última = lo que
    //    resta (la cuota del flyer + el extra). Siempre suman EXACTO el total.
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

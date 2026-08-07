import { AlumnoBase, AlumnoComputed, CuotaPlan, Pago, Situacion } from "./types";
import { PRECIOS_COLEGIO } from "./preciosColegio";
import { PRECIOS_PRENDA_SUELTA } from "./preciosPrendaSuelta";
import { parseNota } from "./format";

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

// Recargos de referencia para "cuánto pagaría si viene hoy" (Plan de cuotas / ficha del
// alumno). Reglas de Paulina, ya confirmadas:
//  - Pago atrasado (cualquier forma): +10% sobre lo pendiente.
//  - Transferencia, débito o crédito EN 1 PAGO: +10% sobre lo pendiente (se encadena con el
//    de atraso si la cuota ya está vencida: primero atraso, después este).
//  - Tarjeta en 3 pagos: +25% en período ABRIL, +30% en período JULIO — el período se toma
//    de HOY (cuándo se cobra), no de la fecha del pedido, porque es el recargo vigente al
//    momento de cobrar.
const RECARGO_ATRASO_PCT = 10;
const RECARGO_NO_EFECTIVO_PCT = 10;
const RECARGO_TARJETA_3_CUOTAS_ABRIL_PCT = 25;
const RECARGO_TARJETA_3_CUOTAS_JULIO_PCT = 30;

function periodoHoyEsJulio(): boolean {
  return isoDate(new Date()) >= "2026-07-01";
}

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

// Identifica el combo del flyer a partir de las PRENDAS del pedido (ignora extras como
// camiseta/bandera/chaleco/deporte, que pueden venir mezclados en los mismos 3 casilleros):
//   C1 = buzo + chomba          C2 = campera + chomba
//   C3 = buzo + chomba + babucha  C4 = campera + chomba + babucha
// Si hay un extra sumado (ej. "CAMISETA | CAMPERA | CHOMBA"), el combo se identifica igual
// (C2) — el costo del extra queda reflejado en el total y se absorbe en la última cuota,
// nunca repartido (misma regla que un extra sin producto adicional). Si las prendas no arman
// ninguno de los 4 combos (ej. una sola prenda suelta), devuelve null y cae al reparto parejo.
function comboDe(base: AlumnoBase): ComboId | null {
  const items = [base.producto1, base.producto2, base.producto3].map((p) => (p || "").toUpperCase());
  const has = (w: string) => items.some((x) => x.includes(w));
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

// Prenda suelta identificada (un único ítem limpio, sin extras). null si no aplica.
function prendaSueltaDe(base: AlumnoBase): string | null {
  const items = [base.producto1, base.producto2, base.producto3]
    .map((p) => (p || "").toUpperCase().trim())
    .filter(Boolean);
  if (items.length !== 1) return null;
  const it = items[0];
  if (it.includes("BUZO")) return "BUZO";
  if (it.includes("CAMPERA")) return "CAMPERA";
  if (it.includes("CHOMBA")) return "CHOMBA";
  if (it.includes("BABUCHA")) return "BABUCHA";
  return null;
}

// Montos de cuota candidatos para el período/nº de cuotas, en orden de prioridad:
//  1. Precio de colegio para el combo (PRECIOS_COLEGIO — solo existe cuando es MENOR al
//     mínimo del flyer, un precio genuinamente distinto y negociado aparte).
//  2. Flyer nacional (para combos identificados por las prendas, con o sin extra sumado).
//  3. Precio de PRENDA SUELTA de ese colegio (PRECIOS_PRENDA_SUELTA) — no hay un precio
//     "nacional" para prendas sueltas: cada colegio tiene el suyo, siempre consistente.
// Nunca se guarda un precio de colegio igual o mayor al flyer: eso sería "flyer + un extra
// que compró la mayoría del grupo", y el extra SIEMPRE va entero en la última cuota, nunca
// promediado entre todas (regla de Paulina).
function cuotasCandidatas(base: AlumnoBase, nCuotas: number): number[] {
  if (nCuotas < 1 || nCuotas > 3) return [];
  const esJulio = !!base.fecha_orden && base.fecha_orden >= "2026-07-01";
  const periodo = esJulio ? "J" : "A";
  const org = (base.organizacion || "").trim().toLowerCase();

  const combo = comboDe(base);
  if (combo) {
    const key = `${org}|||${combo}|||${periodo}|||${nCuotas}`;
    const local = PRECIOS_COLEGIO[key];
    const nacional = (esJulio ? FLYER_JULIO : FLYER_ABRIL)[combo][nCuotas as 1 | 2 | 3];
    return [...new Set(local !== undefined ? [local, nacional] : [nacional])];
  }

  const prenda = prendaSueltaDe(base);
  if (prenda) {
    const pkey = `${org}|||${prenda}|||${periodo}|||${nCuotas}`;
    const precio = PRECIOS_PRENDA_SUELTA[pkey];
    if (precio !== undefined) return [precio];
  }

  return [];
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

// Pedido que NO es un uniforme de colegio (no arma ninguno de los 4 combos ni es una prenda
// suelta reconocida): pedidos de clubes, empresas o personalizados (categorías "Deportes",
// "Institucional", "Personalizados" en el export). Para estos NO existe el concepto de "seña
// de $10.000" — es un invento pensado solo para uniformes escolares.
function esOrdenSinCombo(base: AlumnoBase): boolean {
  return comboDe(base) === null && prendaSueltaDe(base) === null;
}

// Monto de cuota para un pedido SIN combo/prenda (club, empresa, personalizado). No suele ser
// 50/50 exacto: algunos pagan más de entrada, otros de a poco. Se INFIERE del pago real —
// cuota = lo ya pagado ÷ cuotas ya pagadas — igual que se infiere la seña en los uniformes
// escolares. Si todavía no pagó nada, se usa reparto parejo (total / cuotas) como default
// hasta que haga el primer pago.
function montoCuotaSinCombo(base: AlumnoBase): number {
  const total = base.total_asignado;
  const plan = base.plan_cuotas > 0 ? base.plan_cuotas : 1;
  const pagadas = base.cuotas_pagadas_base;
  const pagado = base.monto_pagado_base;
  if (pagadas >= 1 && pagado > 0 && pagadas < plan) {
    const inferida = round2(pagado / pagadas);
    if (inferida > 0 && inferida * plan <= total * 1.5) return inferida; // margen amplio, evita inferencias absurdas
  }
  return round2(total / plan);
}

// Monto de la cuota regular (la que se repite en el plan). Prioriza el precio del flyer:
//  - plan_cuotas <= 1  -> contado: la "cuota" es el total.
//  - plan_cuotas >= 5  -> cuotas iguales (total / n).
//  - pedido SIN combo/prenda (club/empresa) -> se infiere del pago real (ver
//    `montoCuotaSinCombo`); la seña de $10.000 NO aplica, es solo para uniformes escolares.
//  - plan_cuotas 2-4 de un uniforme escolar -> si el combo es identificable y el total
//    alcanza, se usa la cuota EXACTA del flyer (el extra que sobra se cobra entero en la
//    última cuota, nunca repartido). Si no alcanza, se reparte lo que queda tras la seña en
//    partes iguales (fallback seguro que siempre cierra con el total).
// OJO: plan_cuotas cuenta la seña como 1ª cuota, así que las cuotas reales son plan_cuotas - 1.
function montoCuotaRegular(base: AlumnoBase): number {
  const total = base.total_asignado;
  if (total <= 0) return 0;
  const plan = base.plan_cuotas > 0 ? base.plan_cuotas : 1;
  if (plan <= 1) return round2(total);
  if (esOrdenSinCombo(base)) return montoCuotaSinCombo(base);
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
// `cuotasManual` (opcional): importes cargados a mano por Paulina para este alumno (uno por
// cuota, ver src/lib/server/cuotasManuales.ts) — reemplaza el reparto automático cuando su
// cantidad coincide con el plan de cuotas actual.
export function computeAlumno(
  base: AlumnoBase,
  pagos: Pago[],
  cuotasManual?: number[] | null
): AlumnoComputed {
  const sumaPagos = pagos.reduce((acc, p) => acc + (p.monto || 0), 0);
  const interesTotal = pagos.reduce((acc, p) => acc + (p.interes || 0), 0);
  const bonificacionTotal = pagos.reduce((acc, p) => acc + (p.bonificacion || 0), 0);
  // Desglose de interesTotal en "por cuota vencida" vs "precio de lista (no efectivo)": el
  // desglose real viene escondido en la nota (ver construirNota/parseNota en format.ts). Los
  // pagos de ANTES de que existiera este desglose no lo tienen — para esos, todo el interés
  // guardado se cuenta como "atraso", que era el único tipo de recargo que existía antes.
  // IMPORTANTE: este interés es SIEMPRE plata ya cobrada (es parte de un pago ya registrado),
  // nunca un monto pendiente — no se debe sumar al saldo a cobrar.
  let interesAtrasoTotal = 0;
  let interesListaTotal = 0;
  for (const p of pagos) {
    if (!p.interes) continue;
    const { interesAtraso, interesLista } = parseNota(p.nota);
    if (interesAtraso || interesLista) {
      interesAtrasoTotal += interesAtraso;
      interesListaTotal += interesLista;
    } else {
      interesAtrasoTotal += p.interes;
    }
  }
  const montoPagadoTotal = round2(base.monto_pagado_base + sumaPagos);

  const saldo = Math.max(0, round2(base.total_asignado - montoPagadoTotal));

  const cuotas = base.plan_cuotas > 0 ? base.plan_cuotas : 1;
  const montoCuota = montoCuotaRegular(base);
  const manual = cuotasManual && cuotasManual.length === cuotas ? cuotasManual : null;
  // Cuotas pagadas = las que ya trae la planilla (cuotas_pagadas_base, que YA cuenta la seña
  // variable como 1ª cuota) + las cubiertas por los pagos NUEVOS de la app (por monto).
  // Si el saldo quedó en 0, se considera todo pagado.
  // OJO: este conteo asume cuotas de igual tamaño — con importes cargados a mano (desiguales)
  // puede quedar aproximado si además hay pagos nuevos de la app; es una limitación conocida,
  // el saldo y el total pagado (que no dependen de esto) siempre son exactos igual.
  const cuotasPagadasNuevas = montoCuota > 0 ? Math.floor(sumaPagos / montoCuota) : 0;
  const cuotasPagadas =
    saldo <= 0
      ? cuotas
      : Math.min(cuotas, (base.cuotas_pagadas_base || 0) + cuotasPagadasNuevas);
  const cuotasPendientes = Math.max(0, cuotas - cuotasPagadas);
  // Monto por cuota que se muestra/usa de acá en más: si hay importes manuales, el de la
  // PRÓXIMA cuota pendiente (más preciso que un promedio cuando los importes son desiguales).
  const montoCuotaMostrado = manual ? manual[Math.min(cuotasPagadas, manual.length - 1)] : montoCuota;

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
  const montoVencido = atrasado ? Math.min(saldo, round2(cuotasAtrasadas * montoCuotaMostrado)) : 0;

  // Proyecciones de "cuánto pagaría si viene HOY" sobre el saldo pendiente, para que la
  // cajera sepa cuánto cobrar según cómo pague. Si no debe nada (saldo 0), las tres dan 0.
  // El de atraso solo aplica si realmente hay una cuota vencida; los otros dos son por forma
  // de pago y se encadenan con el de atraso cuando corresponde (mismo orden que en PagoForm:
  // primero atraso, después el recargo de la forma de pago, sobre el resultado ya con atraso).
  const conAtraso = atrasado ? saldo * (1 + RECARGO_ATRASO_PCT / 100) : saldo;
  const totalConInteresAtraso = atrasado ? round2(conAtraso) : 0;
  const totalPrecioDeLista = round2(conAtraso * (1 + RECARGO_NO_EFECTIVO_PCT / 100));
  const pctTarjeta3 = periodoHoyEsJulio()
    ? RECARGO_TARJETA_3_CUOTAS_JULIO_PCT
    : RECARGO_TARJETA_3_CUOTAS_ABRIL_PCT;
  const totalTarjeta3Cuotas = round2(conAtraso * (1 + pctTarjeta3 / 100));

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
  const cuotasPlan = buildCuotasPlan(base, cuotas, montoCuota, cuotasPagadas, manual);

  return {
    ...base,
    pagos,
    montoPagadoTotal,
    interesTotal,
    interesAtrasoTotal,
    interesListaTotal,
    bonificacionTotal,
    saldo,
    montoCuota: montoCuotaMostrado,
    cuotasPagadas,
    cuotasPendientes,
    situacion,
    cuotasEsperadas,
    cuotasAtrasadas,
    atrasado,
    montoVencido,
    totalConInteresAtraso,
    totalPrecioDeLista,
    totalTarjeta3Cuotas,
    proximoVencimiento,
    cuotasPlan,
    cuotasManualActivas: !!manual,
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
  cuotasPagadas: number,
  cuotasManual?: number[] | null
): CuotaPlan[] {
  const plan: CuotaPlan[] = [];
  const d = base.fecha_orden
    ? new Date(base.fecha_orden.length <= 10 ? base.fecha_orden + "T00:00:00" : base.fecha_orden)
    : null;
  const ordenValida = d && !isNaN(d.getTime());
  const hoy = Date.now();
  const sena = detectarSena(base);
  const total = base.total_asignado;
  // Importes cargados a mano por Paulina (un número por cuota, en orden — ver
  // src/lib/server/cuotasManuales.ts). Reemplazan el reparto automático cuando existen y su
  // cantidad coincide con el plan actual; sirve para pedidos con precio propio que no siguen
  // ningún patrón de "seña + cuotas iguales" (ej. un integrante que se suma después con un
  // precio distinto al resto del colegio).
  const manual = cuotasManual && cuotasManual.length === cuotas ? cuotasManual : null;
  for (let k = 1; k <= cuotas; k++) {
    const venc = ordenValida ? vencimientoCuota(d as Date, k) : null;
    let estado: CuotaPlan["estado"];
    if (k <= cuotasPagadas) estado = "pagada";
    else if (venc && venc.getTime() <= hoy) estado = "vencida";
    else estado = "pendiente";
    let monto: number;
    if (manual) {
      monto = manual[k - 1];
    } else if (cuotas <= 1) {
      monto = total;
    } else if (base.plan_cuotas >= 5 || esOrdenSinCombo(base)) {
      // Reparto del plan (el extra NUNCA se reparte: va entero en la última cuota):
      //  - plan largo (>=5), o pedido sin combo/prenda (club/empresa, sin seña): todas
      //    iguales (la última absorbe el redondeo).
      monto = k < cuotas ? montoCuota : round2(total - montoCuota * (cuotas - 1));
    } else if (k === 1) {
      // - plan 2-4 de un uniforme escolar: 1ª = seña; intermedias = cuota del flyer
      //   (montoCuota); última = lo que resta (la cuota del flyer + el extra). Siempre
      //   suman EXACTO el total.
      monto = sena;
    } else if (k === cuotas) {
      monto = round2(total - sena - montoCuota * (cuotas - 2));
    } else {
      monto = montoCuota;
    }
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

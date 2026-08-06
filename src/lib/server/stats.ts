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

export type PendienteColegio = {
  organizacion: string;
  alumnosPendientes: number;
  alumnosAtrasados: number;
  totalPendiente: number;
  montoVencido: number;
};

export type PendienteAlumno = {
  alumno_id: string;
  alumno: string;
  saldo: number;
  cuotasPagadas: number;
  cuotasEsperadas: number;
  cuotasAtrasadas: number;
  atrasado: boolean;
  situacion: string;
  proximoVencimiento: string;
};

export type Pendiente = {
  scope: string;
  totalPendiente: number;
  alumnosPendientes: number;
  alumnosAtrasados: number;
  montoVencido: number;
  porColegio: PendienteColegio[];
  alumnos: PendienteAlumno[]; // solo cuando se filtra por un colegio
};

export async function getPendiente(organizacion?: string): Promise<Pendiente> {
  const computed = await getAlumnosComputed(organizacion);

  let totalPendiente = 0;
  let alumnosPendientes = 0;
  let alumnosAtrasados = 0;
  let montoVencido = 0;
  const porColegioMap = new Map<string, PendienteColegio>();

  for (const a of computed) {
    if (a.saldo <= 0) continue;
    totalPendiente += a.saldo;
    alumnosPendientes += 1;
    montoVencido += a.montoVencido;
    if (a.atrasado) alumnosAtrasados += 1;

    const c =
      porColegioMap.get(a.organizacion) ??
      {
        organizacion: a.organizacion,
        alumnosPendientes: 0,
        alumnosAtrasados: 0,
        totalPendiente: 0,
        montoVencido: 0,
      };
    c.alumnosPendientes += 1;
    c.totalPendiente += a.saldo;
    c.montoVencido += a.montoVencido;
    if (a.atrasado) c.alumnosAtrasados += 1;
    porColegioMap.set(a.organizacion, c);
  }

  const porColegio = [...porColegioMap.values()]
    .map((c) => ({
      ...c,
      totalPendiente: round2(c.totalPendiente),
      montoVencido: round2(c.montoVencido),
    }))
    .sort((a, b) => b.totalPendiente - a.totalPendiente);

  // Lista detallada solo cuando se pidió un colegio puntual (para no mandar miles de filas).
  const alumnos: PendienteAlumno[] = organizacion
    ? computed
        .filter((a) => a.saldo > 0)
        .sort(
          (a, b) =>
            Number(b.atrasado) - Number(a.atrasado) ||
            b.cuotasAtrasadas - a.cuotasAtrasadas ||
            b.saldo - a.saldo
        )
        .map((a) => ({
          alumno_id: a.alumno_id,
          alumno: a.alumno,
          saldo: a.saldo,
          cuotasPagadas: a.cuotasPagadas,
          cuotasEsperadas: a.cuotasEsperadas,
          cuotasAtrasadas: a.cuotasAtrasadas,
          atrasado: a.atrasado,
          situacion: a.situacion,
          proximoVencimiento: a.proximoVencimiento,
        }))
    : [];

  return {
    scope: organizacion || "Todos los colegios",
    totalPendiente: round2(totalPendiente),
    alumnosPendientes,
    alumnosAtrasados,
    montoVencido: round2(montoVencido),
    porColegio,
    alumnos,
  };
}

// --- Proyección de cobranza mes a mes (detalle del saldo pendiente) ---
export type ProyeccionMes = { mes: string; monto: number; cuotas: number };
export type Proyeccion = {
  scope: string;
  total: number;                              // ≈ saldo pendiente total
  vencido: { monto: number; cuotas: number }; // cuotas ya vencidas e impagas
  meses: ProyeccionMes[];                     // cuotas futuras agrupadas por mes
};

// Una cuota impaga concreta (para el detalle "qué clientes componen cada mes").
export type ProyeccionFila = {
  grupoKey: string; // "0000-00" para vencido, o "YYYY-MM"
  grupo: string;    // "Vencido" o "YYYY-MM"
  colegio: string;
  alumno: string;
  cuota: number;
  vencimiento: string;
  monto: number;
};

// Modo de vista/cobranza:
//  - "todos":    todo el saldo pendiente.
//  - "atrasado": solo cuotas ya vencidas e impagas.
//  - "esteMes":  cuotas que vencen este mes y NO están vencidas (al día).
export type CobranzaModo = "todos" | "atrasado" | "esteMes";

export function mesActualKey(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export function filtrarFilasPorModo(filas: ProyeccionFila[], modo: CobranzaModo): ProyeccionFila[] {
  if (modo === "atrasado") return filas.filter((f) => f.grupoKey === "0000-00");
  if (modo === "esteMes") return filas.filter((f) => f.grupoKey === mesActualKey());
  return filas;
}

// Reparte el saldo de cada alumno entre sus cuotas impagas (una fila por cuota).
async function proyeccionFilas(organizacion?: string): Promise<ProyeccionFila[]> {
  const computed = await getAlumnosComputed(organizacion);
  const filas: ProyeccionFila[] = [];
  for (const a of computed) {
    if (a.saldo <= 0) continue;
    let restante = a.saldo;
    for (const c of a.cuotasPlan) {
      if (c.estado === "pagada" || restante <= 0) continue;
      const monto = Math.min(c.monto, restante);
      restante = round2(restante - monto);
      const vencida = c.estado === "vencida" || !c.vencimiento;
      filas.push({
        grupoKey: vencida ? "0000-00" : c.vencimiento.slice(0, 7),
        grupo: vencida ? "Vencido" : c.vencimiento.slice(0, 7),
        colegio: a.organizacion,
        alumno: a.alumno,
        cuota: c.numero,
        vencimiento: c.vencimiento,
        monto: round2(monto),
      });
    }
    if (restante > 0.5) {
      filas.push({
        grupoKey: "0000-00", grupo: "Vencido", colegio: a.organizacion,
        alumno: a.alumno, cuota: 0, vencimiento: "", monto: round2(restante),
      });
    }
  }
  return filas;
}

function summarize(filas: ProyeccionFila[], scope: string): Proyeccion {
  let total = 0;
  let vencidoMonto = 0;
  let vencidoCuotas = 0;
  const mesesMap = new Map<string, { monto: number; cuotas: number }>();
  for (const f of filas) {
    total += f.monto;
    if (f.grupoKey === "0000-00") {
      vencidoMonto += f.monto;
      vencidoCuotas += 1;
    } else {
      const b = mesesMap.get(f.grupoKey) ?? { monto: 0, cuotas: 0 };
      b.monto += f.monto;
      b.cuotas += 1;
      mesesMap.set(f.grupoKey, b);
    }
  }
  const meses = [...mesesMap.entries()]
    .map(([mes, v]) => ({ mes, monto: round2(v.monto), cuotas: v.cuotas }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
  return { scope, total: round2(total), vencido: { monto: round2(vencidoMonto), cuotas: vencidoCuotas }, meses };
}

export async function getProyeccionMensual(organizacion?: string): Promise<Proyeccion> {
  const filas = await proyeccionFilas(organizacion);
  return summarize(filas, organizacion || "Todos los colegios");
}

// Detalle (para exportar), opcionalmente filtrado por modo.
export async function getProyeccionDetalle(
  organizacion?: string,
  modo: CobranzaModo = "todos"
): Promise<{ proyeccion: Proyeccion; filas: ProyeccionFila[] }> {
  const all = await proyeccionFilas(organizacion);
  const filas = filtrarFilasPorModo(all, modo);
  return { proyeccion: summarize(filas, organizacion || "Todos los colegios"), filas };
}

// --- Cobranza agrupada por colegio (y por alumno si se filtra), según el modo ---
export type CobranzaColegio = { organizacion: string; alumnos: number; cuotas: number; monto: number };
export type CobranzaAlumno = { alumno: string; cuotas: number; monto: number; vencimiento: string };
export type Cobranza = {
  scope: string;
  modo: CobranzaModo;
  total: number;
  cuotas: number;
  alumnos: number;
  porColegio: CobranzaColegio[];
  alumnosDetalle: CobranzaAlumno[]; // solo cuando se filtra por un colegio
};

export async function getCobranza(modo: CobranzaModo, organizacion?: string): Promise<Cobranza> {
  const all = await proyeccionFilas(organizacion);
  const sel = filtrarFilasPorModo(all, modo);

  const colMap = new Map<string, { alumnos: Set<string>; cuotas: number; monto: number }>();
  const alumnosGlobal = new Set<string>();
  let total = 0;
  for (const f of sel) {
    total += f.monto;
    alumnosGlobal.add(f.colegio + "|" + f.alumno);
    const c = colMap.get(f.colegio) ?? { alumnos: new Set<string>(), cuotas: 0, monto: 0 };
    c.alumnos.add(f.alumno);
    c.cuotas += 1;
    c.monto += f.monto;
    colMap.set(f.colegio, c);
  }
  const porColegio = [...colMap.entries()]
    .map(([organizacion, c]) => ({ organizacion, alumnos: c.alumnos.size, cuotas: c.cuotas, monto: round2(c.monto) }))
    .sort((a, b) => b.monto - a.monto);

  let alumnosDetalle: CobranzaAlumno[] = [];
  if (organizacion) {
    const aMap = new Map<string, CobranzaAlumno>();
    for (const f of sel) {
      const a = aMap.get(f.alumno) ?? { alumno: f.alumno, cuotas: 0, monto: 0, vencimiento: f.vencimiento };
      a.cuotas += 1;
      a.monto += f.monto;
      if (f.vencimiento && (!a.vencimiento || f.vencimiento < a.vencimiento)) a.vencimiento = f.vencimiento;
      aMap.set(f.alumno, a);
    }
    alumnosDetalle = [...aMap.values()]
      .map((a) => ({ ...a, monto: round2(a.monto) }))
      .sort((x, y) => y.monto - x.monto);
  }

  return {
    scope: organizacion || "Todos los colegios",
    modo,
    total: round2(total),
    cuotas: sel.length,
    alumnos: alumnosGlobal.size,
    porColegio,
    alumnosDetalle,
  };
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

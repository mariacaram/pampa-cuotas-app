import "server-only";
import * as XLSX from "xlsx";
import { computeAlumno } from "@/lib/compute";
import { Pago } from "@/lib/types";
import { getRepo } from "./repo";
import { getAlumnosComputed } from "./stats";

// Genera un Excel (.xlsx) con TODA la base:
//  - Hoja "Alumnos": datos base + saldo/cuotas recalculados con los pagos nuevos.
//  - Hoja "Pagos": historial de pagos cargados desde la app.
export async function buildExportBuffer(): Promise<Buffer> {
  const repo = await getRepo();
  const [alumnos, pagos] = await Promise.all([repo.listAllAlumnos(), repo.listAllPagos()]);

  const pagosPorAlumno = new Map<string, Pago[]>();
  for (const p of pagos) {
    const arr = pagosPorAlumno.get(p.alumno_id) ?? [];
    arr.push(p);
    pagosPorAlumno.set(p.alumno_id, arr);
  }

  const alumnosRows = alumnos.map((base) => {
    const c = computeAlumno(base, pagosPorAlumno.get(base.alumno_id) ?? []);
    return {
      Colegio: c.organizacion,
      Alumno: c.alumno,
      "Cliente / Pagador": c.nombre_cliente,
      "N° orden": c.nro_orden,
      "Estado orden": c.estado_orden,
      "Fecha orden": c.fecha_orden,
      "Plan cuotas": c.plan_cuotas,
      "Total asignado": c.total_asignado,
      "Pagado (planilla)": c.monto_pagado_base,
      "Pagos nuevos (app)": Math.round((c.montoPagadoTotal - c.monto_pagado_base) * 100) / 100,
      "Pagado total": c.montoPagadoTotal,
      Saldo: c.saldo,
      "Cuotas pagadas": c.cuotasPagadas,
      "Cuotas pendientes": c.cuotasPendientes,
      "Interés acumulado": c.interesTotal,
      Situación: c.situacion,
    };
  });

  const alumnoById = new Map(alumnos.map((a) => [a.alumno_id, a]));
  const pagosRows = pagos
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((p) => {
      const a = alumnoById.get(p.alumno_id);
      return {
        Fecha: p.fecha,
        Colegio: a?.organizacion ?? "",
        Alumno: a?.alumno ?? "",
        Monto: p.monto,
        "Forma de pago": p.forma_de_pago,
        Interés: p.interes,
        Nota: p.nota,
        "Cargado el": p.creado_en,
      };
    });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alumnosRows), "Alumnos");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      pagosRows.length ? pagosRows : [{ Aviso: "Todavía no se cargaron pagos desde la app" }]
    ),
    "Pagos"
  );

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// Reporte para el encargado de UN colegio:
//  - Hoja "Resumen": totales del colegio (cuántos pagaron todo, cuántos deben, monto pendiente).
//  - Hoja "Detalle alumnos": lista completa ordenada por saldo (los que más deben primero).
export async function buildColegioReportBuffer(
  organizacion: string
): Promise<Buffer> {
  const computed = (await getAlumnosComputed(organizacion)).sort(
    (a, b) => b.saldo - a.saldo || a.alumno.localeCompare(b.alumno, "es")
  );

  const totalAsignado = computed.reduce((s, a) => s + a.total_asignado, 0);
  const totalCobrado = computed.reduce((s, a) => s + a.montoPagadoTotal, 0);
  const saldoPendiente = computed.reduce((s, a) => s + a.saldo, 0);
  const pagaronTodo = computed.filter((a) => a.situacion === "PAGO TOTAL").length;
  const parcial = computed.filter((a) => a.situacion === "PAGO PARCIAL").length;
  const sinPagos = computed.filter((a) => a.situacion === "SIN PAGOS").length;

  const resumen = [
    { Concepto: "Colegio", Valor: organizacion },
    { Concepto: "Fecha del reporte", Valor: new Date().toISOString().slice(0, 10) },
    { Concepto: "Total de alumnos", Valor: computed.length },
    { Concepto: "Pagaron todo", Valor: pagaronTodo },
    { Concepto: "Pagaron en parte (deben saldo)", Valor: parcial },
    { Concepto: "Sin pagos", Valor: sinPagos },
    { Concepto: "Total asignado ($)", Valor: Math.round(totalAsignado) },
    { Concepto: "Total cobrado ($)", Valor: Math.round(totalCobrado) },
    { Concepto: "Saldo pendiente total ($)", Valor: Math.round(saldoPendiente) },
    {
      Concepto: "% cobrado",
      Valor: totalAsignado > 0 ? Math.round((totalCobrado / totalAsignado) * 100) + "%" : "—",
    },
  ];

  const detalle = computed.map((a) => ({
    Alumno: a.alumno,
    "Cliente / Pagador": a.nombre_cliente,
    "Plan cuotas": a.plan_cuotas,
    "Total asignado": a.total_asignado,
    Pagado: a.montoPagadoTotal,
    "Saldo (falta pagar)": a.saldo,
    "Cuotas pagadas": a.cuotasPagadas,
    "Cuotas pendientes": a.cuotasPendientes,
    Situación: a.situacion,
  }));

  const wb = XLSX.utils.book_new();
  const wsResumen = XLSX.utils.json_to_sheet(resumen);
  wsResumen["!cols"] = [{ wch: 32 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  const wsDetalle = XLSX.utils.json_to_sheet(
    detalle.length ? detalle : [{ Aviso: "Este colegio no tiene alumnos cargados" }]
  );
  wsDetalle["!cols"] = [
    { wch: 28 }, { wch: 26 }, { wch: 11 }, { wch: 14 },
    { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle alumnos");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

import "server-only";
import * as XLSX from "xlsx";
import { computeAlumno } from "@/lib/compute";
import { Pago } from "@/lib/types";
import { getRepo } from "./repo";

// Genera un Excel (.xlsx) con toda la información de la base:
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

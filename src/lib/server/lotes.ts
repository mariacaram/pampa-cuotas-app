import "server-only";
import { getRepo } from "./repo";
import { listAuditoria } from "./usuarios";
import { parseNota } from "@/lib/format";

// Un "lote" = un pago grupal: varios alumnos (normalmente del mismo colegio/institución) que
// pagan juntos en un solo momento. Cada integrante sigue siendo un pago independiente en la
// tabla `pagos` (comparten un loteId escondido en `nota`, ver format.ts) — anular uno NO anula
// a los demás. Acá se arma la vista consolidada: quién sigue activo, cuánto suma el lote hoy, y
// el historial de qué se anuló, por qué, y cómo quedó el total (leído de Auditoría).

export type LoteIntegrante = {
  pago_id: number | string;
  alumno_id: string;
  alumno: string;
  monto: number;
  forma_de_pago: string;
  interes: number;
  interesAtraso: number;
  interesLista: number;
  nota: string;
};

export type LoteAnulacion = {
  alumno: string | null;
  monto: number;
  motivo: string;
  usuario: string | null;
  fecha: string;
  totalAntes?: number;
  totalDespues?: number;
};

export type Lote = {
  loteId: string;
  colegio: string;
  fecha: string;
  integrantes: LoteIntegrante[];
  totalActivo: number;
  anulaciones: LoteAnulacion[];
};

export async function getLotes(): Promise<Lote[]> {
  const repo = await getRepo();
  const [pagos, alumnos, auditoria] = await Promise.all([
    repo.listAllPagos(),
    repo.listAllAlumnos(),
    listAuditoria(2000),
  ]);
  const alumnoById = new Map(alumnos.map((a) => [a.alumno_id, a]));

  const porLote = new Map<string, Lote>();

  for (const p of pagos) {
    const { loteId, texto, interesAtraso, interesLista } = parseNota(p.nota);
    if (!loteId) continue;
    const a = alumnoById.get(p.alumno_id);
    let lote = porLote.get(loteId);
    if (!lote) {
      lote = {
        loteId,
        colegio: a?.organizacion ?? "",
        fecha: p.fecha,
        integrantes: [],
        totalActivo: 0,
        anulaciones: [],
      };
      porLote.set(loteId, lote);
    }
    lote.integrantes.push({
      pago_id: p.id,
      alumno_id: p.alumno_id,
      alumno: a?.alumno ?? "(alumno no encontrado)",
      monto: p.monto,
      forma_de_pago: p.forma_de_pago,
      interes: p.interes,
      interesAtraso,
      interesLista,
      nota: texto,
    });
    lote.totalActivo += (p.monto || 0) + (p.interes || 0);
  }

  // Historial de anulaciones: se guarda en Auditoría al momento de anular (ver DELETE
  // /api/pagos), con el total del lote antes/después de ESA anulación puntual. Si un lote quedó
  // sin ningún integrante activo (se anularon todos), igual queda su historial acá.
  for (const row of auditoria) {
    if (row.accion !== "anular_pago") continue;
    const detalle = row.detalle ?? {};
    const loteId = detalle.lote_id as string | undefined;
    if (!loteId) continue;
    let lote = porLote.get(loteId);
    if (!lote) {
      lote = {
        loteId,
        colegio: String(detalle.colegio ?? ""),
        fecha: String(detalle.fecha ?? ""),
        integrantes: [],
        totalActivo: 0,
        anulaciones: [],
      };
      porLote.set(loteId, lote);
    }
    lote.anulaciones.push({
      alumno: (detalle.alumno as string) ?? null,
      monto: Number(detalle.monto ?? 0) + Number(detalle.interes ?? 0),
      motivo: String(detalle.motivo ?? ""),
      usuario: row.usuario_email,
      fecha: row.creado_en,
      totalAntes: detalle.lote_total_antes as number | undefined,
      totalDespues: detalle.lote_total_despues as number | undefined,
    });
  }

  for (const lote of porLote.values()) {
    lote.anulaciones.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  return [...porLote.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

import "server-only";
import { getRepo } from "./repo";
import { parseNota } from "@/lib/format";
import { listUsuarios } from "./usuarios";

export type HistorialPago = {
  id: number | string;
  fecha: string;
  alumno_id: string;
  alumno: string;
  colegio: string;
  monto: number; // solo la cuota (sin interés)
  totalPagado: number; // monto + interés — lo que realmente entró
  forma_de_pago: string;
  interes: number;
  interesAtraso: number;
  interesLista: number;
  bonificacion: number;
  nota: string;
  usuario: string; // nombre de quien lo cobró (o el email; "—" si no se sabe)
  usuarioEmail: string | null;
  // Cuántos pagos más forman parte del mismo cobro dividido (grupoId) — al anular uno se
  // anulan todos juntos, igual que en la ficha del alumno.
  hermanosEnGrupo: number;
  creado_en: string;
};

export type Historial = {
  desde: string;
  hasta: string;
  esAdmin: boolean;
  pagos: HistorialPago[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Historial de pagos: TODOS los pagos que cargó el usuario que consulta (sin importar la forma
// de pago), para que pueda revisarlos y anular los suyos. Un admin ve los de todos los usuarios.
//
// A diferencia de Control de caja (que es un reporte de cuánto entró, y donde lo NO-efectivo es
// compartido entre todas), acá el criterio es autoría: quién registró el cobro. Un usuario
// común NO ve acá los pagos que cargó otra persona, ni siquiera los no-efectivo.
//
// usuarioActual: quien consulta. null = login no configurado (modo prueba abierto) → se trata
// como admin.
export async function getHistorial(
  desde: string,
  hasta: string,
  usuarioActual: { email: string; rol: "admin" | "miembro" } | null
): Promise<Historial> {
  const repo = await getRepo();
  const [alumnos, pagos, usuarios] = await Promise.all([
    repo.listAllAlumnos(),
    repo.listAllPagos(),
    listUsuarios(),
  ]);
  const alumnoById = new Map(alumnos.map((a) => [a.alumno_id, a]));
  const nombrePorEmail = new Map(usuarios.map((u) => [u.email.toLowerCase(), u.nombre || u.email]));

  const esAdmin = !usuarioActual || usuarioActual.rol === "admin";
  const miEmail = (usuarioActual?.email || "").toLowerCase();

  const enRango = pagos.filter((p) => p.fecha >= desde && p.fecha <= hasta);
  const visibles = enRango.filter((p) => {
    if (esAdmin) return true;
    const { usuarioEmail } = parseNota(p.nota);
    return (usuarioEmail || "").toLowerCase() === miEmail;
  });

  // Cuántos pagos comparten cada grupoId (cobro dividido en varias formas de pago) — se cuenta
  // sobre TODOS los pagos del rango, no solo los visibles, para no informar mal cuántas líneas
  // se van a anular junto con esta.
  const conteoGrupo = new Map<string, number>();
  for (const p of enRango) {
    const { grupoId } = parseNota(p.nota);
    if (grupoId) conteoGrupo.set(grupoId, (conteoGrupo.get(grupoId) ?? 0) + 1);
  }

  const lista: HistorialPago[] = visibles
    .slice()
    .sort(
      (a, b) =>
        b.fecha.localeCompare(a.fecha) || String(b.creado_en).localeCompare(String(a.creado_en))
    )
    .map((p) => {
      const a = alumnoById.get(p.alumno_id);
      const { texto, usuarioEmail, grupoId, interesAtraso, interesLista } = parseNota(p.nota);
      return {
        id: p.id,
        fecha: p.fecha,
        alumno_id: p.alumno_id,
        alumno: a?.alumno ?? "(alumno no encontrado)",
        colegio: a?.organizacion ?? "",
        monto: p.monto,
        totalPagado: round2((p.monto || 0) + (p.interes || 0)),
        forma_de_pago: p.forma_de_pago,
        interes: p.interes,
        interesAtraso,
        interesLista,
        bonificacion: p.bonificacion,
        nota: texto,
        usuario: usuarioEmail
          ? nombrePorEmail.get(usuarioEmail.toLowerCase()) || usuarioEmail
          : "—",
        usuarioEmail,
        hermanosEnGrupo: grupoId ? Math.max(0, (conteoGrupo.get(grupoId) ?? 1) - 1) : 0,
        creado_en: String(p.creado_en ?? ""),
      };
    });

  return { desde, hasta, esAdmin, pagos: lista };
}

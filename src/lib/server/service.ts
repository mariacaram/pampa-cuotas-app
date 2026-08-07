import "server-only";
import { computeAlumno } from "@/lib/compute";
import { AlumnoComputed, NuevoPago } from "@/lib/types";
import { getRepo } from "./repo";
import { getCuotasManuales } from "./cuotasManuales";

// Trae un alumno con sus totales recalculados (base + pagos nuevos + importes de cuota
// cargados a mano, si los tiene).
export async function getAlumnoComputed(alumnoId: string): Promise<AlumnoComputed | null> {
  const repo = await getRepo();
  const base = await repo.getAlumnoBase(alumnoId);
  if (!base) return null;
  const [pagos, cuotasManual] = await Promise.all([
    repo.listPagos(alumnoId),
    getCuotasManuales(alumnoId),
  ]);
  return computeAlumno(base, pagos, cuotasManual);
}

// Registra un pago y devuelve el alumno ya recalculado.
export async function registrarPago(input: NuevoPago): Promise<AlumnoComputed> {
  const repo = await getRepo();
  const base = await repo.getAlumnoBase(input.alumno_id);
  if (!base) throw new Error("Alumno no encontrado");
  await repo.addPago(input);
  const [pagos, cuotasManual] = await Promise.all([
    repo.listPagos(input.alumno_id),
    getCuotasManuales(input.alumno_id),
  ]);
  return computeAlumno(base, pagos, cuotasManual);
}

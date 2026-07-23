import "server-only";
import { computeAlumno } from "@/lib/compute";
import { AlumnoComputed, NuevoPago } from "@/lib/types";
import { getRepo } from "./repo";

// Trae un alumno con sus totales recalculados (base + pagos nuevos).
export async function getAlumnoComputed(alumnoId: string): Promise<AlumnoComputed | null> {
  const repo = await getRepo();
  const base = await repo.getAlumnoBase(alumnoId);
  if (!base) return null;
  const pagos = await repo.listPagos(alumnoId);
  return computeAlumno(base, pagos);
}

// Registra un pago y devuelve el alumno ya recalculado.
export async function registrarPago(input: NuevoPago): Promise<AlumnoComputed> {
  const repo = await getRepo();
  const base = await repo.getAlumnoBase(input.alumno_id);
  if (!base) throw new Error("Alumno no encontrado");
  await repo.addPago(input);
  const pagos = await repo.listPagos(input.alumno_id);
  return computeAlumno(base, pagos);
}

import "server-only";
import { AlumnoBase, Colegio, NuevoPago, Pago } from "@/lib/types";

// Contrato del repositorio de datos. Dos implementaciones:
//  - SupabaseRepo: base de datos en la nube (producción).
//  - LocalFileRepo: archivo JSON local (desarrollo / pruebas, sin conexión).
export interface Repo {
  listColegios(): Promise<Colegio[]>;
  listAlumnosByColegio(organizacion: string): Promise<AlumnoBase[]>;
  getAlumnoBase(alumnoId: string): Promise<AlumnoBase | null>;
  listPagos(alumnoId: string): Promise<Pago[]>;
  addPago(pago: NuevoPago): Promise<Pago>;
  source: "supabase" | "local";
}

let cached: Repo | null = null;

export async function getRepo(): Promise<Repo> {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key) {
    const { SupabaseRepo } = await import("./supabaseRepo");
    cached = new SupabaseRepo(url, key);
  } else {
    const { LocalFileRepo } = await import("./localRepo");
    cached = new LocalFileRepo();
  }
  return cached;
}

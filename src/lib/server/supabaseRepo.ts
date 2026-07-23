import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AlumnoBase, Colegio, NuevoPago, Pago } from "@/lib/types";
import { Repo } from "./repo";

// Implementación de producción sobre Supabase (Postgres).
// Usa la Service Role Key: SOLO se usa del lado del servidor, nunca se envía al navegador.
export class SupabaseRepo implements Repo {
  source = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async listColegios(): Promise<Colegio[]> {
    // Traemos solo la columna organizacion y contamos en memoria (199 colegios, liviano).
    const { data, error } = await this.db.from("alumnos").select("organizacion");
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const org = (row as { organizacion: string }).organizacion;
      counts.set(org, (counts.get(org) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([organizacion, cantidadAlumnos]) => ({ organizacion, cantidadAlumnos }))
      .sort((a, b) => a.organizacion.localeCompare(b.organizacion, "es"));
  }

  async listAlumnosByColegio(organizacion: string): Promise<AlumnoBase[]> {
    const { data, error } = await this.db
      .from("alumnos")
      .select("*")
      .eq("organizacion", organizacion)
      .order("alumno", { ascending: true });
    if (error) throw error;
    return (data ?? []) as AlumnoBase[];
  }

  async getAlumnoBase(alumnoId: string): Promise<AlumnoBase | null> {
    const { data, error } = await this.db
      .from("alumnos")
      .select("*")
      .eq("alumno_id", alumnoId)
      .maybeSingle();
    if (error) throw error;
    return (data as AlumnoBase | null) ?? null;
  }

  async listPagos(alumnoId: string): Promise<Pago[]> {
    const { data, error } = await this.db
      .from("pagos")
      .select("*")
      .eq("alumno_id", alumnoId)
      .order("fecha", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Pago[];
  }

  async addPago(input: NuevoPago): Promise<Pago> {
    const { data, error } = await this.db
      .from("pagos")
      .insert({
        alumno_id: input.alumno_id,
        fecha: input.fecha,
        monto: input.monto,
        forma_de_pago: input.forma_de_pago,
        interes: input.interes,
        nota: input.nota,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Pago;
  }
}

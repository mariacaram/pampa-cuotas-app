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

  // Trae TODAS las filas de una consulta, paginando de a 1000 (límite por request de Supabase).
  private async fetchAll<T>(
    table: string,
    columns: string
  ): Promise<T[]> {
    const PAGE = 1000;
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.db
        .from(table)
        .select(columns)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as T[];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return out;
  }

  async listColegios(): Promise<Colegio[]> {
    // Traemos solo la columna organizacion (paginado) y contamos en memoria.
    const rows = await this.fetchAll<{ organizacion: string }>("alumnos", "organizacion");
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.organizacion, (counts.get(row.organizacion) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([organizacion, cantidadAlumnos]) => ({ organizacion, cantidadAlumnos }))
      .sort((a, b) => a.organizacion.localeCompare(b.organizacion, "es"));
  }

  async listAllAlumnos(): Promise<AlumnoBase[]> {
    return this.fetchAll<AlumnoBase>("alumnos", "*");
  }

  async listAllPagos(): Promise<Pago[]> {
    return this.fetchAll<Pago>("pagos", "*");
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
        interes_pct: input.interes_pct,
        bonificacion: input.bonificacion,
        nota: input.nota,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Pago;
  }
}

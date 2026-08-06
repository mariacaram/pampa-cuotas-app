import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AlumnoBase, Colegio, NuevaVenta, NuevoPago, Pago } from "@/lib/types";
import { Repo } from "./repo";

// Cache en memoria (por instancia del servidor). Los datos base cambian poco (reimport
// esporádico), así que un TTL corto evita re-bajar 5000+ filas en cada request/navegación.
const TTL_MS = 90_000;
type Cache<T> = { data: T; expires: number } | null;
let alumnosCache: Cache<AlumnoBase[]> = null;
let pagosCache: Cache<Pago[]> = null;

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
  private async fetchAll<T>(table: string, columns: string): Promise<T[]> {
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

  async listAllAlumnos(): Promise<AlumnoBase[]> {
    if (alumnosCache && alumnosCache.expires > Date.now()) return alumnosCache.data;
    const data = await this.fetchAll<AlumnoBase>("alumnos", "*");
    alumnosCache = { data, expires: Date.now() + TTL_MS };
    return data;
  }

  async listAllPagos(): Promise<Pago[]> {
    if (pagosCache && pagosCache.expires > Date.now()) return pagosCache.data;
    const data = await this.fetchAll<Pago>("pagos", "*");
    pagosCache = { data, expires: Date.now() + TTL_MS };
    return data;
  }

  // ---- Todo lo demás se sirve desde los dos arrays cacheados (sin round-trips extra) ----

  async listColegios(): Promise<Colegio[]> {
    const rows = await this.listAllAlumnos();
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.organizacion, (counts.get(row.organizacion) ?? 0) + 1);
    return [...counts.entries()]
      .map(([organizacion, cantidadAlumnos]) => ({ organizacion, cantidadAlumnos }))
      .sort((a, b) => a.organizacion.localeCompare(b.organizacion, "es"));
  }

  async listAlumnosByColegio(organizacion: string): Promise<AlumnoBase[]> {
    const rows = await this.listAllAlumnos();
    return rows
      .filter((a) => a.organizacion === organizacion)
      .sort((a, b) => a.alumno.localeCompare(b.alumno, "es"));
  }

  async getAlumnoBase(alumnoId: string): Promise<AlumnoBase | null> {
    const rows = await this.listAllAlumnos();
    return rows.find((a) => a.alumno_id === alumnoId) ?? null;
  }

  async listPagos(alumnoId: string): Promise<Pago[]> {
    const rows = await this.listAllPagos();
    return rows
      .filter((p) => p.alumno_id === alumnoId)
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
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
    pagosCache = null; // invalidar: el próximo cálculo incluye el pago nuevo
    return data as Pago;
  }

  async getPago(pagoId: number | string): Promise<Pago | null> {
    const rows = await this.listAllPagos();
    return rows.find((p) => String(p.id) === String(pagoId)) ?? null;
  }

  async deletePago(pagoId: number | string): Promise<void> {
    const { error } = await this.db.from("pagos").delete().eq("id", pagoId);
    if (error) throw error;
    pagosCache = null; // invalidar: el pago ya no está
  }

  async addAlumno(venta: NuevaVenta): Promise<AlumnoBase> {
    // La seña (1ª cuota, ya cobrada) solo aplica en planes de 2+ cuotas.
    const sena = (venta.sena ?? 0) > 0 && venta.plan_cuotas >= 2
      ? Math.min(venta.sena!, venta.total_asignado)
      : 0;
    const saldoBase = Math.round((venta.total_asignado - sena) * 100) / 100;
    const row: AlumnoBase = {
      alumno_id: crypto.randomUUID(),
      alumno: venta.alumno.trim(),
      nombre_cliente: venta.nombre_cliente?.trim() || "",
      organizacion: venta.organizacion.trim(),
      // Marcador de origen: las ventas cargadas desde la app llevan nro_orden "APP-…"
      // y estado_orden "APP" para que una reimportación del Excel NO las pise.
      nro_orden: `APP-${Date.now()}`,
      estado_orden: "APP",
      fecha_orden: venta.fecha_orden,
      forma_de_pago: venta.forma_de_pago,
      plan_cuotas: venta.plan_cuotas,
      cuotas_generadas: venta.plan_cuotas,
      cuotas_pagadas_base: sena > 0 ? 1 : 0,
      total_asignado: venta.total_asignado,
      monto_pagado_base: sena,
      saldo_base: saldoBase,
      situacion_base: saldoBase <= 0 ? "PAGO TOTAL" : sena > 0 ? "PAGO PARCIAL" : "SIN PAGOS",
      fecha_creacion_orden: venta.fecha_orden,
      productos: [venta.producto1, venta.producto2, venta.producto3].map((p) => (p ?? "").trim()).filter(Boolean).join(" | "),
      producto1: (venta.producto1 ?? "").trim(),
      talle1: (venta.talle1 ?? "").trim(),
      producto2: (venta.producto2 ?? "").trim(),
      talle2: (venta.talle2 ?? "").trim(),
      producto3: (venta.producto3 ?? "").trim(),
      talle3: (venta.talle3 ?? "").trim(),
    };
    const { error } = await this.db.from("alumnos").insert(row);
    if (error) throw error;
    alumnosCache = null; // invalidar: aparece el alumno nuevo
    return row;
  }
}

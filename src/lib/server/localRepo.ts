import "server-only";
import fs from "node:fs";
import path from "node:path";
import { AlumnoBase, Colegio, NuevaVenta, NuevoPago, Pago } from "@/lib/types";
import { Repo } from "./repo";

// Implementación para desarrollo/pruebas sin base de datos.
// Lee los alumnos de data/alumnos.local.json (ignorado por git, datos reales)
// y guarda/lee los pagos de data/pagos.local.json.
const DATA_DIR = path.join(process.cwd(), "data");
const ALUMNOS_FILE = path.join(DATA_DIR, "alumnos.local.json");
const PAGOS_FILE = path.join(DATA_DIR, "pagos.local.json");

let alumnosCache: AlumnoBase[] | null = null;

function loadAlumnos(): AlumnoBase[] {
  if (alumnosCache) return alumnosCache;
  if (!fs.existsSync(ALUMNOS_FILE)) {
    alumnosCache = [];
    return alumnosCache;
  }
  const raw = fs.readFileSync(ALUMNOS_FILE, "utf-8");
  alumnosCache = JSON.parse(raw) as AlumnoBase[];
  return alumnosCache;
}

function loadPagos(): Pago[] {
  if (!fs.existsSync(PAGOS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(PAGOS_FILE, "utf-8")) as Pago[];
  } catch {
    return [];
  }
}

function savePagos(pagos: Pago[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PAGOS_FILE, JSON.stringify(pagos, null, 2), "utf-8");
}

function saveAlumnos(alumnos: AlumnoBase[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ALUMNOS_FILE, JSON.stringify(alumnos, null, 2), "utf-8");
  alumnosCache = alumnos;
}

export class LocalFileRepo implements Repo {
  source = "local" as const;

  async listColegios(): Promise<Colegio[]> {
    const counts = new Map<string, number>();
    for (const a of loadAlumnos()) {
      counts.set(a.organizacion, (counts.get(a.organizacion) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([organizacion, cantidadAlumnos]) => ({ organizacion, cantidadAlumnos }))
      .sort((a, b) => a.organizacion.localeCompare(b.organizacion, "es"));
  }

  async listAlumnosByColegio(organizacion: string): Promise<AlumnoBase[]> {
    return loadAlumnos()
      .filter((a) => a.organizacion === organizacion)
      .sort((a, b) => a.alumno.localeCompare(b.alumno, "es"));
  }

  async getAlumnoBase(alumnoId: string): Promise<AlumnoBase | null> {
    return loadAlumnos().find((a) => a.alumno_id === alumnoId) ?? null;
  }

  async listPagos(alumnoId: string): Promise<Pago[]> {
    return loadPagos()
      .filter((p) => p.alumno_id === alumnoId)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  async listAllAlumnos(): Promise<AlumnoBase[]> {
    return loadAlumnos();
  }

  async listAllPagos(): Promise<Pago[]> {
    return loadPagos();
  }

  async addPago(input: NuevoPago): Promise<Pago> {
    const pagos = loadPagos();
    const pago: Pago = {
      id: Date.now(),
      alumno_id: input.alumno_id,
      fecha: input.fecha,
      monto: input.monto,
      forma_de_pago: input.forma_de_pago,
      interes: input.interes,
      interes_pct: input.interes_pct,
      bonificacion: input.bonificacion,
      nota: input.nota,
      creado_en: new Date().toISOString(),
    };
    pagos.push(pago);
    savePagos(pagos);
    return pago;
  }

  async getPago(pagoId: number | string): Promise<Pago | null> {
    return loadPagos().find((p) => String(p.id) === String(pagoId)) ?? null;
  }

  async deletePago(pagoId: number | string): Promise<void> {
    const pagos = loadPagos().filter((p) => String(p.id) !== String(pagoId));
    savePagos(pagos);
  }

  async addAlumno(venta: NuevaVenta): Promise<AlumnoBase> {
    const sena = (venta.sena ?? 0) > 0 && venta.plan_cuotas >= 2
      ? Math.min(venta.sena!, venta.total_asignado)
      : 0;
    const saldoBase = Math.round((venta.total_asignado - sena) * 100) / 100;
    const row: AlumnoBase = {
      alumno_id: crypto.randomUUID(),
      alumno: venta.alumno.trim(),
      nombre_cliente: venta.nombre_cliente?.trim() || "",
      organizacion: venta.organizacion.trim(),
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
    const alumnos = [...loadAlumnos(), row];
    saveAlumnos(alumnos);
    return row;
  }

  async updateAlumnoTotales(
    alumnoId: string,
    cambios: { plan_cuotas: number; total_asignado: number }
  ): Promise<void> {
    const alumnos = loadAlumnos();
    const idx = alumnos.findIndex((a) => a.alumno_id === alumnoId);
    if (idx < 0) throw new Error("Alumno no encontrado");
    const actual = alumnos[idx];
    const saldoBase = Math.round((cambios.total_asignado - actual.monto_pagado_base) * 100) / 100;
    alumnos[idx] = {
      ...actual,
      plan_cuotas: cambios.plan_cuotas,
      total_asignado: cambios.total_asignado,
      saldo_base: saldoBase,
      situacion_base: saldoBase <= 0 ? "PAGO TOTAL" : actual.monto_pagado_base > 0 ? "PAGO PARCIAL" : "SIN PAGOS",
    };
    saveAlumnos(alumnos);
  }
}

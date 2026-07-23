import "server-only";
import fs from "node:fs";
import path from "node:path";
import { AlumnoBase, Colegio, NuevoPago, Pago } from "@/lib/types";
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

  async addPago(input: NuevoPago): Promise<Pago> {
    const pagos = loadPagos();
    const pago: Pago = {
      id: Date.now(),
      alumno_id: input.alumno_id,
      fecha: input.fecha,
      monto: input.monto,
      forma_de_pago: input.forma_de_pago,
      interes: input.interes,
      nota: input.nota,
      creado_en: new Date().toISOString(),
    };
    pagos.push(pago);
    savePagos(pagos);
    return pago;
  }
}

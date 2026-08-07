import "server-only";
import { getRepo } from "./repo";
import { parseNota } from "@/lib/format";
import { listUsuarios } from "./usuarios";

export type CajaMedio = { forma: string; cantidad: number; monto: number };
export type CajaPago = {
  fecha: string;
  alumno: string;
  colegio: string;
  monto: number; // solo la cuota (sin interés)
  totalPagado: number; // monto + interés — la plata que REALMENTE entró por ese pago
  forma_de_pago: string;
  interes: number;
  bonificacion: number;
  nota: string;
  usuario: string; // quién lo cobró (nombre si se conoce, si no el email; "—" si no se sabe)
};
export type CajaUsuarioResumen = { usuario: string; cantidad: number; monto: number };
export type Caja = {
  desde: string;
  hasta: string;
  cantidadPagos: number;
  totalCobrado: number;
  totalInteres: number;
  totalBonificado: number;
  porMedio: CajaMedio[];
  pagos: CajaPago[];
  esAdmin: boolean;
  // Cuánto efectivo cobró cada usuario en el período — solo se completa para admins (una
  // cajera no ve cuánto cobraron las demás, solo lo suyo).
  efectivoPorUsuario: CajaUsuarioResumen[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function esEfectivo(forma: string): boolean {
  return (forma || "").trim().toLowerCase() === "efectivo";
}

// Control de caja: pagos cargados en la app dentro del rango [desde, hasta].
//
// Privacidad: el efectivo es "su caja" de quien lo cobró — cada usuario solo ve (y descarga)
// los cobros en EFECTIVO que hizo ella misma, para poder cuadrarla; un admin ve el efectivo de
// todas. El resto de las formas de pago (transferencia, tarjeta, QR, terceros...) es un reporte
// COMPARTIDO: cualquier usuario lo ve completo, siempre mostrando quién cobró cada uno.
//
// usuarioActual: quien pide el reporte. null = sin login configurado (modo prueba abierto) —
// se trata como admin, ve todo, no tiene sentido restringir nada.
export async function getCaja(
  desde: string,
  hasta: string,
  usuarioActual: { email: string; rol: "admin" | "miembro" } | null
): Promise<Caja> {
  const repo = await getRepo();
  const [alumnos, pagos, usuarios] = await Promise.all([
    repo.listAllAlumnos(),
    repo.listAllPagos(),
    listUsuarios(),
  ]);
  const nombreAlumno = new Map(alumnos.map((a) => [a.alumno_id, a]));
  const nombrePorEmail = new Map(usuarios.map((u) => [u.email.toLowerCase(), u.nombre || u.email]));

  function nombreDe(email: string | null): string {
    if (!email) return "—";
    return nombrePorEmail.get(email.toLowerCase()) || email;
  }

  const esAdmin = !usuarioActual || usuarioActual.rol === "admin";
  const miEmail = (usuarioActual?.email || "").toLowerCase();

  const enRango = pagos.filter((p) => p.fecha >= desde && p.fecha <= hasta);

  const visibles = enRango.filter((p) => {
    if (!esEfectivo(p.forma_de_pago)) return true;
    if (esAdmin) return true;
    const { usuarioEmail } = parseNota(p.nota);
    return (usuarioEmail || "").toLowerCase() === miEmail;
  });

  // IMPORTANTE: los totales (acá, por medio de pago, y por usuario más abajo) suman
  // monto + interés — la plata que REALMENTE entró en cada pago — no solo la cuota. Si sumaran
  // solo la cuota, nunca cerrarían contra la plata real en la mano (arqueo de caja) ni contra
  // lo que efectivamente se transfirió/acreditó (conciliación bancaria de pagos virtuales).
  let totalCobrado = 0;
  let totalInteres = 0;
  let totalBonificado = 0;
  const medioMap = new Map<string, CajaMedio>();

  for (const p of visibles) {
    const total = (p.monto || 0) + (p.interes || 0);
    totalCobrado += total;
    totalInteres += p.interes || 0;
    totalBonificado += p.bonificacion || 0;
    const forma = (p.forma_de_pago || "Sin especificar").trim();
    const m = medioMap.get(forma) ?? { forma, cantidad: 0, monto: 0 };
    m.cantidad += 1;
    m.monto += total;
    medioMap.set(forma, m);
  }

  const porMedio = [...medioMap.values()]
    .map((m) => ({ ...m, monto: round2(m.monto) }))
    .sort((a, b) => b.monto - a.monto);

  const lista: CajaPago[] = visibles
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.creado_en).localeCompare(String(b.creado_en)))
    .map((p) => {
      const a = nombreAlumno.get(p.alumno_id);
      const { texto, usuarioEmail } = parseNota(p.nota);
      return {
        fecha: p.fecha,
        alumno: a?.alumno ?? "(alumno no encontrado)",
        colegio: a?.organizacion ?? "",
        monto: p.monto,
        totalPagado: round2((p.monto || 0) + (p.interes || 0)),
        forma_de_pago: p.forma_de_pago,
        interes: p.interes,
        bonificacion: p.bonificacion,
        nota: texto,
        usuario: nombreDe(usuarioEmail),
      };
    });

  // Resumen de efectivo por usuario (todo el rango, no solo lo "visible" — para un admin es lo
  // mismo, ya que ve todo). Solo se calcula/devuelve para admins.
  let efectivoPorUsuario: CajaUsuarioResumen[] = [];
  if (esAdmin) {
    const efectivo = enRango.filter((p) => esEfectivo(p.forma_de_pago));
    const map = new Map<string, CajaUsuarioResumen>();
    for (const p of efectivo) {
      const { usuarioEmail } = parseNota(p.nota);
      const key = nombreDe(usuarioEmail);
      const r = map.get(key) ?? { usuario: key, cantidad: 0, monto: 0 };
      r.cantidad += 1;
      r.monto += (p.monto || 0) + (p.interes || 0);
      map.set(key, r);
    }
    efectivoPorUsuario = [...map.values()]
      .map((r) => ({ ...r, monto: round2(r.monto) }))
      .sort((a, b) => b.monto - a.monto);
  }

  return {
    desde,
    hasta,
    cantidadPagos: visibles.length,
    totalCobrado: round2(totalCobrado),
    totalInteres: round2(totalInteres),
    totalBonificado: round2(totalBonificado),
    porMedio,
    pagos: lista,
    esAdmin,
    efectivoPorUsuario,
  };
}

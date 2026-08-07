export function formatMoney(n: number): string {
  return (n || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const FORMAS_DE_PAGO = [
  "Efectivo",
  "Mercado Pago",
  "Banco Nación CB",
  "Terceros",
  "Otro",
];

export const SITUACION_STYLES: Record<string, string> = {
  "PAGO TOTAL": "bg-green-100 text-green-800",
  "PAGO PARCIAL": "bg-amber-100 text-amber-800",
  "SIN PAGOS": "bg-neutral-200 text-neutral-700",
};

// --- Metadata escondida dentro de `nota` ---
// La tabla `pagos` no tiene columnas para esto (no hay forma de hacer un ALTER TABLE desde acá),
// así que se guarda como uno o más prefijos invisibles al principio de `nota`. Nunca se ve en
// pantalla: `parseNota` siempre los saca antes de mostrar el texto real.
//   1) grupoId: agrupa las líneas de un mismo cobro (mismo alumno) dividido en varias formas
//      de pago (ej.: una cuota pagada parte en efectivo y parte por transferencia). Al anular
//      una línea, se anulan todas las del grupo juntas (ver DELETE /api/pagos) — es un solo
//      cobro, no pagos independientes.
//   2) desglose de interés: cuánto del `interes` guardado corresponde a "pago atrasado" y
//      cuánto a "precio de lista" (recargo por no pagar en efectivo), para poder discriminarlos
//      en las estadísticas del alumno. Pagos viejos (antes de este desglose) no lo tienen —
//      quien los lea debe asumir que ese interés es 100% "pago atrasado", que era el único tipo
//      de recargo que existía antes.
//   3) loteId: agrupa pagos de VARIOS ALUMNOS distintos que se cobraron juntos en un mismo pago
//      grupal (ej.: una institución paga de una vez la cuota de varios chicos). A diferencia de
//      grupoId, acá CADA integrante se puede anular por separado sin afectar a los demás — el
//      loteId es solo para poder mostrar "de qué cobro grupal viene" y reconstruir el total del
//      lote (ver src/lib/server/lotes.ts y el detalle que se guarda en Auditoría al anular).
//   4) usuarioEmail: qué usuario cobró este pago — para los reportes de Control de Caja (cada
//      cajera solo ve/descarga sus propios cobros en EFECTIVO, para cuadrar su caja; el resto
//      de las formas de pago es un reporte compartido pero igual muestra quién lo cobró). Lo
//      agrega SIEMPRE el servidor (POST /api/pagos, con el usuario de la sesión — nunca lo que
//      mande el cliente), para que no se pueda falsear. Pagos de antes de este feature no lo
//      tienen (quedan sin usuario asignado).
const SEP = "⁣"; // U+2063 INVISIBLE SEPARATOR
const GRUPO_REGEX = new RegExp(`^${SEP}grp:([a-zA-Z0-9-]+)${SEP}`);
const LOTE_REGEX = new RegExp(`^${SEP}lote:([a-zA-Z0-9-]+)${SEP}`);
const INT_REGEX = new RegExp(`^${SEP}int:(-?[0-9.]+),(-?[0-9.]+)${SEP}`);
const USR_REGEX = new RegExp(`^${SEP}usr:([^${SEP}]+)${SEP}`);

export function construirNota(
  texto: string,
  opts?: {
    grupoId?: string | null;
    loteId?: string | null;
    interesAtraso?: number;
    interesLista?: number;
    usuarioEmail?: string | null;
  }
): string {
  const limpio = (texto || "").trim();
  let prefijo = "";
  if (opts?.grupoId) prefijo += `${SEP}grp:${opts.grupoId}${SEP}`;
  if (opts?.loteId) prefijo += `${SEP}lote:${opts.loteId}${SEP}`;
  if (opts?.interesAtraso || opts?.interesLista) {
    prefijo += `${SEP}int:${Math.round(opts.interesAtraso || 0)},${Math.round(opts.interesLista || 0)}${SEP}`;
  }
  if (opts?.usuarioEmail) prefijo += `${SEP}usr:${opts.usuarioEmail}${SEP}`;
  return `${prefijo}${limpio}`;
}

export function parseNota(raw: string | null | undefined): {
  texto: string;
  grupoId: string | null;
  loteId: string | null;
  interesAtraso: number;
  interesLista: number;
  usuarioEmail: string | null;
} {
  let s = raw || "";
  let grupoId: string | null = null;
  let loteId: string | null = null;
  let interesAtraso = 0;
  let interesLista = 0;
  let usuarioEmail: string | null = null;

  const mGrupo = s.match(GRUPO_REGEX);
  if (mGrupo) {
    grupoId = mGrupo[1];
    s = s.slice(mGrupo[0].length);
  }
  const mLote = s.match(LOTE_REGEX);
  if (mLote) {
    loteId = mLote[1];
    s = s.slice(mLote[0].length);
  }
  const mInt = s.match(INT_REGEX);
  if (mInt) {
    interesAtraso = Number(mInt[1]) || 0;
    interesLista = Number(mInt[2]) || 0;
    s = s.slice(mInt[0].length);
  }
  const mUsr = s.match(USR_REGEX);
  if (mUsr) {
    usuarioEmail = mUsr[1];
    s = s.slice(mUsr[0].length);
  }
  return { texto: s, grupoId, loteId, interesAtraso, interesLista, usuarioEmail };
}

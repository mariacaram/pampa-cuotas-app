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
//   1) grupoId: agrupa las líneas de un mismo cobro dividido en varias formas de pago (ej.:
//      una cuota pagada parte en efectivo y parte por transferencia). Al anular una línea, se
//      anulan todas las del grupo juntas (ver DELETE /api/pagos).
//   2) desglose de interés: cuánto del `interes` guardado corresponde a "pago atrasado" y
//      cuánto a "precio de lista" (recargo por no pagar en efectivo), para poder discriminarlos
//      en las estadísticas del alumno. Pagos viejos (antes de este desglose) no lo tienen —
//      quien los lea debe asumir que ese interés es 100% "pago atrasado", que era el único tipo
//      de recargo que existía antes.
const SEP = "⁣"; // U+2063 INVISIBLE SEPARATOR
const GRUPO_REGEX = new RegExp(`^${SEP}grp:([a-zA-Z0-9-]+)${SEP}`);
const INT_REGEX = new RegExp(`^${SEP}int:(-?[0-9.]+),(-?[0-9.]+)${SEP}`);

export function construirNota(
  texto: string,
  opts?: { grupoId?: string | null; interesAtraso?: number; interesLista?: number }
): string {
  const limpio = (texto || "").trim();
  let prefijo = "";
  if (opts?.grupoId) prefijo += `${SEP}grp:${opts.grupoId}${SEP}`;
  if (opts?.interesAtraso || opts?.interesLista) {
    prefijo += `${SEP}int:${Math.round(opts.interesAtraso || 0)},${Math.round(opts.interesLista || 0)}${SEP}`;
  }
  return `${prefijo}${limpio}`;
}

export function parseNota(raw: string | null | undefined): {
  texto: string;
  grupoId: string | null;
  interesAtraso: number;
  interesLista: number;
} {
  let s = raw || "";
  let grupoId: string | null = null;
  let interesAtraso = 0;
  let interesLista = 0;

  const mGrupo = s.match(GRUPO_REGEX);
  if (mGrupo) {
    grupoId = mGrupo[1];
    s = s.slice(mGrupo[0].length);
  }
  const mInt = s.match(INT_REGEX);
  if (mInt) {
    interesAtraso = Number(mInt[1]) || 0;
    interesLista = Number(mInt[2]) || 0;
    s = s.slice(mInt[0].length);
  }
  return { texto: s, grupoId, interesAtraso, interesLista };
}

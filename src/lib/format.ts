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

// --- Agrupar un pago dividido en varias formas de pago (ej.: una cuota pagada parte en
// efectivo y parte por transferencia) ---
// La tabla `pagos` no tiene una columna dedicada para esto, así que el ID de grupo se guarda
// como un prefijo dentro de `nota` (invisible para el usuario: se saca siempre al mostrarla
// con `parseNota`). Todas las líneas de un mismo cobro dividido comparten el mismo grupoId;
// al anular una, se anulan todas juntas (ver DELETE /api/pagos).
const GRUPO_PREFIJO = "⁣grp:"; // ⁣ = separador invisible, no se ve aunque no se filtre
const GRUPO_REGEX = /^⁣grp:([a-zA-Z0-9-]+)⁣/;

export function construirNota(texto: string, grupoId?: string | null): string {
  const limpio = (texto || "").trim();
  if (!grupoId) return limpio;
  return `${GRUPO_PREFIJO}${grupoId}⁣${limpio}`;
}

export function parseNota(raw: string | null | undefined): { texto: string; grupoId: string | null } {
  const s = raw || "";
  const m = s.match(GRUPO_REGEX);
  if (!m) return { texto: s, grupoId: null };
  return { texto: s.slice(m[0].length), grupoId: m[1] };
}

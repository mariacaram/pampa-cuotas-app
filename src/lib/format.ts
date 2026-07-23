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

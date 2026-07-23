import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        accent
          ? "border-emerald-700 bg-emerald-700 text-white"
          : "border-neutral-200/70 bg-white"
      }`}
    >
      <p className={`text-xs ${accent ? "text-emerald-100" : "text-neutral-500"}`}>{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && (
        <p className={`mt-1 text-xs ${accent ? "text-emerald-100" : "text-neutral-400"}`}>{sub}</p>
      )}
    </div>
  );
}

const PILL: Record<string, string> = {
  "PAGO TOTAL": "bg-emerald-100 text-emerald-800",
  "PAGO PARCIAL": "bg-amber-100 text-amber-800",
  "SIN PAGOS": "bg-neutral-200 text-neutral-700",
};

export function SituacionPill({ situacion }: { situacion: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        PILL[situacion] ?? "bg-neutral-200 text-neutral-700"
      }`}
    >
      {situacion}
    </span>
  );
}

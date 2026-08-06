import { ReactNode } from "react";
import CountUp from "./motion/CountUp";

export function Card({
  children,
  className = "",
  interactive = true,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`card bg-white ${interactive ? "card-interactive" : ""} p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent = false,
  animateTo,
  format,
  onClick,
}: {
  label: string;
  value?: string;
  sub?: string;
  accent?: boolean;
  animateTo?: number;
  format?: (n: number) => string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={`card card-interactive p-5 ${onClick ? "cursor-pointer" : ""} ${
        accent ? "border-transparent bg-emerald-700 text-white" : "bg-white"
      }`}
      style={
        accent
          ? { boxShadow: "0 10px 26px rgba(39, 93, 149, 0.35)" }
          : undefined
      }
    >
      <p className={`text-xs font-medium ${accent ? "text-emerald-100" : "text-neutral-500"}`}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">
        {animateTo !== undefined && format ? (
          <CountUp value={animateTo} format={format} />
        ) : (
          value
        )}
      </p>
      {sub && (
        <p className={`mt-1 text-xs ${accent ? "text-emerald-100" : "text-neutral-400"}`}>{sub}</p>
      )}
      {onClick && (
        <p className={`mt-1 text-xs font-medium ${accent ? "text-emerald-100" : "text-emerald-700"}`}>
          Ver por mes ›
        </p>
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
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        PILL[situacion] ?? "bg-neutral-200 text-neutral-700"
      }`}
    >
      {situacion}
    </span>
  );
}

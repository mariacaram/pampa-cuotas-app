"use client";

import { CuotaPlan } from "@/lib/types";
import { formatMoney } from "@/lib/format";

const ESTILO: Record<CuotaPlan["estado"], { base: string; activo: string }> = {
  pagada: { base: "bg-emerald-100 text-emerald-800 cursor-default", activo: "" },
  vencida: {
    base: "bg-red-100 text-red-700 cursor-pointer hover:bg-red-200",
    activo: "ring-2 ring-red-500 bg-red-200",
  },
  pendiente: {
    base: "bg-sky-100 text-sky-700 cursor-pointer hover:bg-sky-200",
    activo: "ring-2 ring-sky-500 bg-sky-200",
  },
};

// Fila de "píldoras", una por cuota: verde = pagada (no se toca), roja = vencida, celeste =
// pendiente. Clickeando una vencida o pendiente se tilda/destilda para pagarla ahora — así se
// elige directo desde la fila del alumno, sin abrir su ficha.
export default function CuotaChips({
  cuotas,
  seleccionadas,
  onToggle,
}: {
  cuotas: CuotaPlan[];
  seleccionadas: Set<number>;
  onToggle: (numero: number) => void;
}) {
  if (cuotas.length === 0) return <span className="text-xs text-neutral-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {cuotas.map((c) => {
        const estilo = ESTILO[c.estado];
        const activo = seleccionadas.has(c.numero);
        return (
          <button
            key={c.numero}
            type="button"
            disabled={c.estado === "pagada"}
            onClick={(e) => {
              e.stopPropagation();
              if (c.estado !== "pagada") onToggle(c.numero);
            }}
            title={`Cuota ${c.numero}° — ${c.estado}`}
            className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${estilo.base} ${
              activo ? estilo.activo : ""
            }`}
          >
            {formatMoney(c.monto)}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { formatMoney } from "@/lib/format";

type Proyeccion = {
  scope: string;
  total: number;
  vencido: { monto: number; cuotas: number };
  meses: { mes: string; monto: number; cuotas: number }[];
};

function nombreMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  if (!y || !m) return mes;
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ProyeccionModal({
  proyeccion,
  loading,
  organizacion,
  onClose,
}: {
  proyeccion: Proyeccion | null;
  loading: boolean;
  organizacion?: string;
  onClose: () => void;
}) {
  const max = proyeccion
    ? Math.max(proyeccion.vencido.monto, ...proyeccion.meses.map((m) => m.monto), 1)
    : 1;
  const qs = organizacion ? `&organizacion=${encodeURIComponent(organizacion)}` : "";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="thin-scroll max-h-[85vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Saldo pendiente por mes</h2>
            <p className="text-sm text-neutral-500">
              Cuánto debería ingresar cada mes {proyeccion ? `· ${proyeccion.scope}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
          >
            Cerrar
          </button>
        </div>

        {loading || !proyeccion ? (
          <p className="py-6 text-center text-sm text-neutral-400">Calculando…</p>
        ) : (
          <>
            <div className="mb-3 rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700">Total pendiente</p>
              <p className="text-2xl font-bold text-emerald-900">{formatMoney(proyeccion.total)}</p>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <a
                href={`/api/proyeccion/export?format=xlsx${qs}`}
                className="btn rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                ⬇ Excel (por cliente)
              </a>
              <a
                href={`/api/proyeccion/export?format=pdf${qs}`}
                className="btn rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                ⬇ PDF (por cliente)
              </a>
            </div>

            <div className="space-y-2">
              {proyeccion.vencido.monto > 0 && (
                <Fila
                  titulo="Vencido (ya debería estar cobrado)"
                  monto={proyeccion.vencido.monto}
                  cuotas={proyeccion.vencido.cuotas}
                  max={max}
                  rojo
                />
              )}
              {proyeccion.meses.map((m) => (
                <Fila
                  key={m.mes}
                  titulo={nombreMes(m.mes)}
                  monto={m.monto}
                  cuotas={m.cuotas}
                  max={max}
                />
              ))}
              {proyeccion.meses.length === 0 && proyeccion.vencido.monto === 0 && (
                <p className="py-4 text-center text-sm text-neutral-400">
                  No hay cuotas pendientes.
                </p>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function Fila({
  titulo,
  monto,
  cuotas,
  max,
  rojo,
}: {
  titulo: string;
  monto: number;
  cuotas: number;
  max: number;
  rojo?: boolean;
}) {
  const pct = Math.max(3, Math.round((monto / max) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={`font-medium ${rojo ? "text-red-700" : "text-neutral-800"}`}>{titulo}</span>
        <span className="whitespace-nowrap">
          <span className={`font-bold ${rojo ? "text-red-700" : "text-neutral-900"}`}>
            {formatMoney(monto)}
          </span>
          <span className="ml-2 text-xs text-neutral-400">
            {cuotas} cuota{cuotas === 1 ? "" : "s"}
          </span>
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <motion.div
          className={`h-full rounded-full ${rojo ? "bg-red-400" : "bg-emerald-500"}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

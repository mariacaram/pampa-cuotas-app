"use client";

import { AlumnoComputed } from "@/lib/types";
import { formatMoney, formatDate, SITUACION_STYLES } from "@/lib/format";
import PagoForm from "./PagoForm";

type Props = {
  alumno: AlumnoComputed;
  onRegistrado: () => void;
};

export default function AlumnoDetail({ alumno, onRegistrado }: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-neutral-200 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{alumno.alumno}</h2>
            <p className="text-sm text-neutral-500">{alumno.organizacion}</p>
            {alumno.nombre_cliente && (
              <p className="text-xs text-neutral-400">Paga: {alumno.nombre_cliente}</p>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              SITUACION_STYLES[alumno.situacion] ?? "bg-neutral-200 text-neutral-700"
            }`}
          >
            {alumno.situacion}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total asignado" value={formatMoney(alumno.total_asignado)} />
          <Stat label="Pagado" value={formatMoney(alumno.montoPagadoTotal)} />
          <Stat label="Saldo" value={formatMoney(alumno.saldo)} highlight />
          <Stat label="Monto por cuota" value={formatMoney(alumno.montoCuota)} />
          <Stat label="Plan de cuotas" value={String(alumno.plan_cuotas)} />
          <Stat label="Cuotas pagadas" value={String(alumno.cuotasPagadas)} />
          <Stat label="Cuotas pendientes" value={String(alumno.cuotasPendientes)} highlight />
          <Stat label="N° orden" value={alumno.nro_orden || "—"} />
        </div>

        {alumno.interesTotal > 0 && (
          <p className="mt-3 text-xs text-neutral-500">
            Interés por atraso acumulado: {formatMoney(alumno.interesTotal)}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-neutral-900 p-4 text-white">
            <p className="text-xs text-neutral-300">Saldo pendiente</p>
            <p className="text-2xl font-semibold">{formatMoney(alumno.saldo)}</p>
          </div>
          <div className="rounded-lg bg-neutral-100 p-4">
            <p className="text-xs text-neutral-500">Total a cobrar (saldo + interés)</p>
            <p className="text-2xl font-semibold text-neutral-900">
              {formatMoney(alumno.saldo + alumno.interesTotal)}
            </p>
          </div>
        </div>
      </div>

      <PagoForm alumnoId={alumno.alumno_id} onRegistrado={onRegistrado} />

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-800">
          Pagos registrados desde la app ({alumno.pagos.length})
        </p>
        {alumno.pagos.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Todavía no cargaste pagos nuevos para este alumno.
            {alumno.monto_pagado_base > 0 && (
              <> El pagado inicial ({formatMoney(alumno.monto_pagado_base)}) viene de la planilla.</>
            )}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-xs text-neutral-500">
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Monto</th>
                  <th className="p-2">Forma</th>
                  <th className="p-2">Interés</th>
                  <th className="p-2">Nota</th>
                </tr>
              </thead>
              <tbody>
                {alumno.pagos.map((p) => (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="p-2">{formatDate(p.fecha)}</td>
                    <td className="p-2">{formatMoney(p.monto)}</td>
                    <td className="p-2">{p.forma_de_pago}</td>
                    <td className="p-2">{p.interes ? formatMoney(p.interes) : "—"}</td>
                    <td className="p-2 text-neutral-500">{p.nota || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-sm ${highlight ? "font-semibold" : ""}`}>{value}</p>
    </div>
  );
}

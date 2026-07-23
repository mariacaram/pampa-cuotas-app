"use client";

import { AlumnoComputed } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/format";
import { Card, SituacionPill } from "./ui";
import PagoForm from "./PagoForm";

type Props = {
  alumno: AlumnoComputed;
  onRegistrado: () => void;
};

export default function AlumnoDetail({ alumno, onRegistrado }: Props) {
  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">{alumno.alumno}</h2>
            <p className="text-sm text-neutral-500">{alumno.organizacion}</p>
            {alumno.nombre_cliente && (
              <p className="text-xs text-neutral-400">Paga: {alumno.nombre_cliente}</p>
            )}
          </div>
          <SituacionPill situacion={alumno.situacion} />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total asignado" value={formatMoney(alumno.total_asignado)} />
          <Stat label="Pagado" value={formatMoney(alumno.montoPagadoTotal)} />
          <Stat label="Saldo" value={formatMoney(alumno.saldo)} highlight />
          <Stat label="Monto por cuota" value={formatMoney(alumno.montoCuota)} />
          <Stat label="Plan de cuotas" value={String(alumno.plan_cuotas)} />
          <Stat label="Cuotas pagadas" value={String(alumno.cuotasPagadas)} />
          <Stat label="Cuotas pendientes" value={String(alumno.cuotasPendientes)} highlight />
          <div>
            <p className="text-xs text-neutral-500">Cuotas atrasadas</p>
            <p className={`text-sm font-bold ${alumno.cuotasAtrasadas > 0 ? "text-red-600" : "text-neutral-700"}`}>
              {alumno.cuotasAtrasadas}
            </p>
          </div>
          <Stat
            label="Próx. vencimiento"
            value={alumno.proximoVencimiento ? formatDate(alumno.proximoVencimiento) : "—"}
          />
        </div>

        {(alumno.interesTotal > 0 || alumno.bonificacionTotal > 0) && (
          <p className="mt-3 text-xs text-neutral-500">
            {alumno.interesTotal > 0 && <>Interés acumulado: {formatMoney(alumno.interesTotal)}. </>}
            {alumno.bonificacionTotal > 0 && (
              <>Bonificaciones otorgadas: {formatMoney(alumno.bonificacionTotal)}.</>
            )}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-emerald-700 p-4 text-white">
            <p className="text-xs text-emerald-100">Saldo pendiente</p>
            <p className="text-2xl font-bold">{formatMoney(alumno.saldo)}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs text-emerald-700">Total a cobrar (saldo + interés)</p>
            <p className="text-2xl font-bold text-emerald-900">
              {formatMoney(alumno.saldo + alumno.interesTotal)}
            </p>
          </div>
        </div>
      </Card>

      <PagoForm
        alumnoId={alumno.alumno_id}
        montoCuota={alumno.montoCuota}
        cuotasRestantes={alumno.cuotasPendientes}
        onRegistrado={onRegistrado}
      />

      <div>
        <p className="mb-2 text-sm font-semibold text-neutral-800">
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
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Monto</th>
                  <th className="p-3">Forma</th>
                  <th className="p-3">Interés</th>
                  <th className="p-3">Bonificación</th>
                  <th className="p-3">Nota</th>
                </tr>
              </thead>
              <tbody>
                {alumno.pagos.map((p) => (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="p-3">{formatDate(p.fecha)}</td>
                    <td className="p-3">{formatMoney(p.monto)}</td>
                    <td className="p-3">{p.forma_de_pago}</td>
                    <td className="p-3">
                      {p.interes ? `${formatMoney(p.interes)}${p.interes_pct ? ` (${p.interes_pct}%)` : ""}` : "—"}
                    </td>
                    <td className="p-3">{p.bonificacion ? formatMoney(p.bonificacion) : "—"}</td>
                    <td className="p-3 text-neutral-500">{p.nota || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-sm ${highlight ? "font-bold text-emerald-800" : "font-medium"}`}>{value}</p>
    </div>
  );
}

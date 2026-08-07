"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
import { Card } from "./ui";

type Stats = {
  scope: string;
  totalAlumnos: number;
  totalAsignado: number;
  totalCobrado: number;
  saldoPendiente: number;
  pctCobrado: number;
  situacion: { PAGO_TOTAL: number; PAGO_PARCIAL: number; SIN_PAGOS: number };
  formasDePago: { forma: string; cantidad: number }[];
};

// Resumen del pedido de un colegio entero: totales + cuántos alumnos eligieron cada forma de
// pago (con un total de recuento) — lo primero que se ve al elegir un colegio, antes de entrar
// a la ficha de un alumno puntual.
export default function ColegioResumen({
  colegio,
  onAgregarIntegrante,
}: {
  colegio: string;
  onAgregarIntegrante: () => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!colegio) return;
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/stats?organizacion=${encodeURIComponent(colegio)}`);
        const data = await res.json();
        if (cancel) return;
        if (!res.ok) throw new Error(data.error || "Error cargando el resumen");
        setStats(data.stats);
      } catch (e) {
        if (!cancel) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [colegio]);

  if (loading) return <p className="text-sm text-neutral-400">Cargando resumen del colegio…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!stats) return null;

  const totalFormas = stats.formasDePago.reduce((acc, f) => acc + f.cantidad, 0);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">{colegio}</h2>
          <p className="text-sm text-neutral-500">
            {stats.totalAlumnos} integrante{stats.totalAlumnos !== 1 ? "s" : ""} · {stats.pctCobrado}% cobrado
          </p>
        </div>
        <button
          type="button"
          onClick={onAgregarIntegrante}
          className="btn btn-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Agregar integrante
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total a pagar" value={formatMoney(stats.totalAsignado)} />
        <Stat label="Pagado" value={formatMoney(stats.totalCobrado)} />
        <Stat label="Saldo" value={formatMoney(stats.saldoPendiente)} highlight />
        <Stat label="Integrantes" value={String(stats.totalAlumnos)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500">
        <span>
          Pago total: <b className="text-neutral-800">{stats.situacion.PAGO_TOTAL}</b>
        </span>
        <span>
          Pago parcial: <b className="text-neutral-800">{stats.situacion.PAGO_PARCIAL}</b>
        </span>
        <span>
          Sin pagos: <b className="text-neutral-800">{stats.situacion.SIN_PAGOS}</b>
        </span>
      </div>

      {stats.formasDePago.length > 0 && (
        <div className="mt-4 rounded-lg bg-neutral-50 p-3">
          <p className="mb-2 text-xs font-semibold text-neutral-600">
            Resumen de pagos — cantidad de integrantes por forma de pago
          </p>
          <table className="w-full text-sm">
            <tbody>
              {stats.formasDePago.map((f) => (
                <tr key={f.forma} className="border-t border-neutral-200 first:border-0">
                  <td className="py-1.5 text-neutral-700">{f.forma}</td>
                  <td className="py-1.5 text-right font-medium text-neutral-800">{f.cantidad}</td>
                </tr>
              ))}
              <tr className="border-t border-neutral-300 font-semibold">
                <td className="py-1.5 text-neutral-800">Total</td>
                <td className="py-1.5 text-right text-neutral-900">{totalFormas}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
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

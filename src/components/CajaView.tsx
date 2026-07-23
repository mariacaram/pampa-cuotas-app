"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import { Card, StatCard } from "./ui";

type CajaMedio = { forma: string; cantidad: number; monto: number };
type CajaPago = {
  fecha: string;
  alumno: string;
  colegio: string;
  monto: number;
  forma_de_pago: string;
  interes: number;
  bonificacion: number;
  nota: string;
};
type Caja = {
  desde: string;
  hasta: string;
  cantidadPagos: number;
  totalCobrado: number;
  totalInteres: number;
  totalBonificado: number;
  porMedio: CajaMedio[];
  pagos: CajaPago[];
};

function inicioDeMes() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
}
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function CajaView() {
  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(hoy());
  const [data, setData] = useState<Caja | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/caja?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`
        );
        const d = await res.json();
        if (cancel) return;
        if (!res.ok) throw new Error(d.error || "Error cargando la caja");
        setData(d.caja);
      } catch (e) {
        if (!cancel) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [desde, hasta]);

  const qs = `desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Control de caja</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Pagos cobrados desde la app en el período elegido: total, medios de pago y bonificaciones.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-neutral-500">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="mt-1 rounded-lg border border-neutral-300 p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="mt-1 rounded-lg border border-neutral-300 p-2 text-sm"
            />
          </div>
          <a
            href={`/api/caja/export?format=xlsx&${qs}`}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            ⬇ Excel
          </a>
          <a
            href={`/api/caja/export?format=pdf&${qs}`}
            className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            ⬇ PDF
          </a>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading && !data ? (
        <p className="text-sm text-neutral-400">Cargando…</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total cobrado" value={formatMoney(data.totalCobrado)} accent />
            <StatCard label="Cantidad de pagos" value={String(data.cantidadPagos)} />
            <StatCard label="Total bonificado" value={formatMoney(data.totalBonificado)} />
            <StatCard label="Total interés" value={formatMoney(data.totalInteres)} />
          </div>

          <Card>
            <p className="mb-4 font-semibold text-neutral-800">Por medio de pago</p>
            {data.porMedio.length === 0 ? (
              <p className="text-sm text-neutral-400">Sin pagos en el período.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-neutral-500">
                  <tr>
                    <th className="py-1">Medio</th>
                    <th className="py-1">Cantidad</th>
                    <th className="py-1">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porMedio.map((m) => (
                    <tr key={m.forma} className="border-t border-neutral-100">
                      <td className="py-2">{m.forma}</td>
                      <td className="py-2">{m.cantidad}</td>
                      <td className="py-2 font-medium">{formatMoney(m.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="p-0">
            <div className="border-b border-neutral-100 px-5 py-3">
              <p className="text-sm font-semibold text-neutral-800">
                Detalle de pagos ({data.pagos.length})
              </p>
            </div>
            <div className="thin-scroll max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Alumno</th>
                    <th className="p-3">Colegio</th>
                    <th className="p-3">Monto</th>
                    <th className="p-3">Medio</th>
                    <th className="p-3">Bonif.</th>
                    <th className="p-3">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pagos.map((p, i) => (
                    <tr key={i} className="border-t border-neutral-100">
                      <td className="p-3">{formatDate(p.fecha)}</td>
                      <td className="p-3">{p.alumno}</td>
                      <td className="p-3 text-neutral-500">{p.colegio}</td>
                      <td className="p-3 font-medium">{formatMoney(p.monto)}</td>
                      <td className="p-3">{p.forma_de_pago}</td>
                      <td className="p-3">{p.bonificacion ? formatMoney(p.bonificacion) : "—"}</td>
                      <td className="p-3 text-neutral-500">{p.nota || "—"}</td>
                    </tr>
                  ))}
                  {data.pagos.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-neutral-400">
                        No hay pagos registrados en este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

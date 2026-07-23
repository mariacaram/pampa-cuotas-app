"use client";

import { useEffect, useMemo, useState } from "react";
import { Colegio } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/format";
import { Card, StatCard, SituacionPill } from "./ui";

type PendienteColegio = {
  organizacion: string;
  alumnosPendientes: number;
  alumnosAtrasados: number;
  totalPendiente: number;
  montoVencido: number;
};
type PendienteAlumno = {
  alumno_id: string;
  alumno: string;
  saldo: number;
  cuotasPagadas: number;
  cuotasEsperadas: number;
  cuotasAtrasadas: number;
  atrasado: boolean;
  situacion: string;
  proximoVencimiento: string;
};
type Pendiente = {
  scope: string;
  totalPendiente: number;
  alumnosPendientes: number;
  alumnosAtrasados: number;
  montoVencido: number;
  porColegio: PendienteColegio[];
  alumnos: PendienteAlumno[];
};

export default function PendienteView({ colegios }: { colegios: Colegio[] }) {
  const [filtro, setFiltro] = useState("");
  const [colegio, setColegio] = useState("");
  const [data, setData] = useState<Pendiente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const url = colegio
          ? `/api/pendiente?organizacion=${encodeURIComponent(colegio)}`
          : "/api/pendiente";
        const res = await fetch(url);
        const d = await res.json();
        if (cancel) return;
        if (!res.ok) throw new Error(d.error || "Error cargando pendientes");
        setData(d.pendiente);
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

  const colegiosFiltrados = useMemo(() => {
    const q = filtro.trim().toLocaleLowerCase("es");
    if (!q) return colegios;
    return colegios.filter((c) => c.organizacion.toLocaleLowerCase("es").includes(q));
  }, [colegios, filtro]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Pendiente de cobro</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Dónde apuntar: cuánto falta cobrar y quiénes están atrasados{data ? ` · ${data.scope}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-neutral-500">Filtrar por colegio</label>
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar…"
              className="mt-1 w-44 rounded-lg border border-neutral-300 p-2 text-sm"
            />
          </div>
          <select
            value={colegio}
            onChange={(e) => setColegio(e.target.value)}
            className="rounded-lg border border-neutral-300 p-2 text-sm"
          >
            <option value="">Todos los colegios ({colegios.length})</option>
            {colegiosFiltrados.map((c) => (
              <option key={c.organizacion} value={c.organizacion}>
                {c.organizacion} ({c.cantidadAlumnos})
              </option>
            ))}
          </select>
          <a
            href={`/api/pendiente/export?format=xlsx${colegio ? `&organizacion=${encodeURIComponent(colegio)}` : ""}`}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            ⬇ Excel
          </a>
          <a
            href={`/api/pendiente/export?format=pdf${colegio ? `&organizacion=${encodeURIComponent(colegio)}` : ""}`}
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
            <StatCard label="Total pendiente" value={formatMoney(data.totalPendiente)} accent />
            <StatCard
              label="Alumnos con saldo"
              value={data.alumnosPendientes.toLocaleString("es-AR")}
            />
            <StatCard
              label="Alumnos atrasados"
              value={data.alumnosAtrasados.toLocaleString("es-AR")}
              sub="atrasados en cuotas"
            />
            <StatCard
              label="Monto vencido (est.)"
              value={formatMoney(data.montoVencido)}
              sub="lo que ya debería estar pago"
            />
          </div>

          <p className="text-xs text-neutral-400">
            Vencimientos: la 1ª cuota vence a fin del mes de la orden; la 2ª, 3ª, … el 15 de cada
            mes siguiente. El atraso compara esos vencimientos contra la fecha de hoy.
          </p>

          {!colegio ? (
            <Card className="p-0">
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
                <p className="text-sm font-semibold text-neutral-800">
                  Colegios ordenados por lo que falta cobrar
                </p>
                <span className="text-xs text-neutral-400">Tocá un colegio para ver el detalle</span>
              </div>
              <div className="thin-scroll max-h-[32rem] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
                    <tr>
                      <th className="p-3">Colegio</th>
                      <th className="p-3">Pendientes</th>
                      <th className="p-3">Atrasados</th>
                      <th className="p-3">Total pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.porColegio.map((c) => (
                      <tr
                        key={c.organizacion}
                        onClick={() => setColegio(c.organizacion)}
                        className="cursor-pointer border-t border-neutral-100 hover:bg-emerald-50/50"
                      >
                        <td className="p-3">{c.organizacion}</td>
                        <td className="p-3">{c.alumnosPendientes}</td>
                        <td className="p-3">
                          {c.alumnosAtrasados > 0 ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                              {c.alumnosAtrasados}
                            </span>
                          ) : (
                            <span className="text-neutral-400">0</span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-emerald-800">
                          {formatMoney(c.totalPendiente)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="p-0">
              <div className="border-b border-neutral-100 px-5 py-3">
                <p className="text-sm font-semibold text-neutral-800">
                  Alumnos con saldo en {colegio} ({data.alumnos.length}) · atrasados primero
                </p>
              </div>
              <div className="thin-scroll max-h-[32rem] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
                    <tr>
                      <th className="p-3">Alumno</th>
                      <th className="p-3">Saldo</th>
                      <th className="p-3">Cuotas (pagadas/esperadas)</th>
                      <th className="p-3">Próx. vence</th>
                      <th className="p-3">Atraso</th>
                      <th className="p-3">Situación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.alumnos.map((a) => (
                      <tr
                        key={a.alumno_id}
                        className={`border-t border-neutral-100 ${a.atrasado ? "bg-red-50/40" : ""}`}
                      >
                        <td className="p-3">{a.alumno}</td>
                        <td className="p-3 font-medium">{formatMoney(a.saldo)}</td>
                        <td className="p-3 text-neutral-600">
                          {a.cuotasPagadas} / {a.cuotasEsperadas}
                        </td>
                        <td className="p-3 text-neutral-600">
                          {a.proximoVencimiento ? formatDate(a.proximoVencimiento) : "—"}
                        </td>
                        <td className="p-3">
                          {a.atrasado ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                              {a.cuotasAtrasadas} atrasada{a.cuotasAtrasadas > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              al día
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <SituacionPill situacion={a.situacion} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

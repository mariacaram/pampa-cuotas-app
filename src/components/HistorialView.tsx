"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import { Card } from "./ui";

type HistorialPago = {
  id: number | string;
  fecha: string;
  alumno_id: string;
  alumno: string;
  colegio: string;
  monto: number;
  totalPagado: number;
  forma_de_pago: string;
  interes: number;
  interesAtraso: number;
  interesLista: number;
  bonificacion: number;
  nota: string;
  usuario: string;
  usuarioEmail: string | null;
  hermanosEnGrupo: number;
  creado_en: string;
};

type Historial = {
  desde: string;
  hasta: string;
  esAdmin: boolean;
  pagos: HistorialPago[];
};

function haceDias(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

// Historial de pagos: cada usuaria ve los cobros que registró ELLA (un admin ve los de todas) y
// puede anularlos desde acá, siempre indicando el motivo. El control de quién puede anular qué
// también está en el servidor (DELETE /api/pagos), no solo en esta pantalla.
export default function HistorialView() {
  const [desde, setDesde] = useState(haceDias(30));
  const [hasta, setHasta] = useState(hoy());
  const [data, setData] = useState<Historial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [anulandoId, setAnulandoId] = useState<number | string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/historial?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error cargando el historial");
      setData(d.historial);
      setError(null);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  async function anular(id: number | string) {
    if (!motivo.trim()) {
      setError("Escribí el motivo de la anulación.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/pagos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, motivo: motivo.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo anular");
      setAnulandoId(null);
      setMotivo("");
      await cargar();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }

  const totalPeriodo = (data?.pagos ?? []).reduce((acc, p) => acc + p.totalPagado, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Historial de pagos</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Los cobros que registraste, con la opción de anularlos indicando el motivo.
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
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {data && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {data.esAdmin
            ? "Sos admin: ves los cobros registrados por todos los usuarios, y podés anular cualquiera."
            : "Ves solo los cobros que registraste vos, y solo esos podés anular."}
        </div>
      )}

      {loading && !data ? (
        <p className="text-sm text-neutral-400">Cargando…</p>
      ) : data ? (
        <Card className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-3">
            <p className="text-sm font-semibold text-neutral-800">
              {data.pagos.length} cobro{data.pagos.length !== 1 ? "s" : ""} en el período
            </p>
            <p className="text-sm text-neutral-600">
              Total: <span className="font-semibold text-neutral-900">{formatMoney(totalPeriodo)}</span>
            </p>
          </div>
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[62rem] text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Alumno</th>
                  <th className="p-3">Colegio</th>
                  <th className="p-3">Total pagado</th>
                  <th className="p-3">Cuota</th>
                  <th className="p-3">Int. cuota vencida</th>
                  <th className="p-3">Int. no efectivo</th>
                  <th className="p-3">Forma</th>
                  {data.esAdmin && <th className="p-3">Usuario</th>}
                  <th className="p-3">Nota</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.pagos.map((p) => (
                  <FilaPago
                    key={p.id}
                    p={p}
                    esAdmin={data.esAdmin}
                    anulando={anulandoId === p.id}
                    motivo={motivo}
                    saving={saving}
                    onStart={() => {
                      setAnulandoId(p.id);
                      setMotivo("");
                      setError(null);
                    }}
                    onCancel={() => {
                      setAnulandoId(null);
                      setMotivo("");
                    }}
                    onMotivo={setMotivo}
                    onConfirm={() => anular(p.id)}
                  />
                ))}
                {data.pagos.length === 0 && (
                  <tr>
                    <td colSpan={data.esAdmin ? 11 : 10} className="p-4 text-center text-neutral-400">
                      No hay cobros registrados en este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function FilaPago({
  p,
  esAdmin,
  anulando,
  motivo,
  saving,
  onStart,
  onCancel,
  onMotivo,
  onConfirm,
}: {
  p: HistorialPago;
  esAdmin: boolean;
  anulando: boolean;
  motivo: string;
  saving: boolean;
  onStart: () => void;
  onCancel: () => void;
  onMotivo: (v: string) => void;
  onConfirm: () => void;
}) {
  const colSpan = esAdmin ? 11 : 10;
  return (
    <>
      <tr className="border-t border-neutral-100">
        <td className="p-3">{formatDate(p.fecha)}</td>
        <td className="p-3">{p.alumno}</td>
        <td className="p-3 text-neutral-500">{p.colegio}</td>
        <td className="p-3 font-semibold">
          {formatMoney(p.totalPagado)}
          {p.hermanosEnGrupo > 0 && (
            <span
              className="ml-1 text-[11px] font-normal text-neutral-400"
              title="Este cobro se dividió en varias formas de pago"
            >
              (1 de {p.hermanosEnGrupo + 1})
            </span>
          )}
        </td>
        <td className="p-3">{formatMoney(p.monto)}</td>
        <td className="p-3 text-amber-700">{p.interesAtraso ? formatMoney(p.interesAtraso) : "—"}</td>
        <td className="p-3 text-sky-700">{p.interesLista ? formatMoney(p.interesLista) : "—"}</td>
        <td className="p-3">{p.forma_de_pago}</td>
        {esAdmin && <td className="p-3 text-neutral-500">{p.usuario}</td>}
        <td className="p-3 text-neutral-500">{p.nota || "—"}</td>
        <td className="p-3 text-right">
          {!anulando && (
            <button
              onClick={onStart}
              className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Anular
            </button>
          )}
        </td>
      </tr>
      {anulando && (
        <tr className="bg-red-50/50">
          <td colSpan={colSpan} className="p-3">
            <p className="mb-2 text-xs font-semibold text-red-700">
              {p.hermanosEnGrupo > 0
                ? `Este cobro se dividió en ${p.hermanosEnGrupo + 1} formas de pago — al anular, se anulan TODAS juntas. Indicá el motivo:`
                : `Anular el cobro de ${p.alumno} (${formatMoney(p.totalPagado)}) — indicá el motivo:`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={motivo}
                onChange={(e) => onMotivo(e.target.value)}
                placeholder="Ej.: se cargó por error / el cliente pidió reintegro"
                className="w-full rounded-md border border-neutral-300 p-2 text-sm sm:min-w-64 sm:flex-1"
              />
              <button
                onClick={onConfirm}
                disabled={saving}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {saving ? "Anulando…" : "Confirmar anulación"}
              </button>
              <button
                onClick={onCancel}
                disabled={saving}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Cancelar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

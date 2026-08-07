"use client";

import { useState } from "react";
import { AlumnoBase } from "@/lib/types";
import { FORMAS_DE_PAGO, formatMoney, construirNota } from "@/lib/format";

type Props = {
  colegio: string;
  alumnos: AlumnoBase[]; // los seleccionados
  onRegistrado: () => void;
  onCancel: () => void;
};

type Fila = { monto: string; forma: string; aplicarRecargo: boolean };

// Pago grupal: una institución paga junto la cuota de varios alumnos. Cada integrante queda
// como un pago independiente (se puede anular uno sin tocar a los demás), pero todos comparten
// un loteId escondido en la nota (ver construirNota/parseNota) para poder verlos juntos y saber
// de qué cobro grupal viene cada uno — ver "Pagos grupales" más abajo en esta misma pantalla.
export default function PagoGrupalForm({ colegio, alumnos, onRegistrado, onCancel }: Props) {
  const [filas, setFilas] = useState<Record<string, Fila>>(() =>
    Object.fromEntries(
      alumnos.map((a) => [a.alumno_id, { monto: "", forma: FORMAS_DE_PAGO[0], aplicarRecargo: false }])
    )
  );
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [atrasado, setAtrasado] = useState(false);
  const [pctAtraso, setPctAtraso] = useState("");
  const [precioLista, setPrecioLista] = useState(false);
  const [pctLista, setPctLista] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAtraso = Number(pctAtraso) || 0;
  const numLista = Number(pctLista) || 0;

  function actualizarFila(alumnoId: string, cambios: Partial<Fila>) {
    setFilas((prev) => ({ ...prev, [alumnoId]: { ...prev[alumnoId], ...cambios } }));
  }

  // Recargo de UNA fila puntual (cada integrante puede o no tener recargo, y el monto base de
  // cada uno es distinto) — misma cadena que en PagoForm: primero atraso, después precio de
  // lista sobre el resultado ya con atraso.
  function calcularRecargo(fila: Fila) {
    const base = Number(fila.monto) || 0;
    if (!fila.aplicarRecargo || base <= 0) return { interesAtraso: 0, interesLista: 0, total: 0 };
    const conAtraso = atrasado ? base * (1 + numAtraso / 100) : base;
    const conListaYAtraso = precioLista ? conAtraso * (1 + numLista / 100) : conAtraso;
    const interesAtraso = Math.round(conAtraso - base);
    const interesLista = Math.round(conListaYAtraso - conAtraso);
    return { interesAtraso, interesLista, total: interesAtraso + interesLista };
  }

  const filasConMonto = alumnos.filter((a) => (Number(filas[a.alumno_id]?.monto) || 0) > 0);
  const totalMontos = filasConMonto.reduce((acc, a) => acc + (Number(filas[a.alumno_id].monto) || 0), 0);
  const totalRecargos = filasConMonto.reduce((acc, a) => acc + calcularRecargo(filas[a.alumno_id]).total, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (filasConMonto.length === 0) {
      setError("Ingresá el monto cobrado de al menos un integrante.");
      return;
    }

    setSaving(true);
    try {
      const loteId = crypto.randomUUID();
      for (const a of filasConMonto) {
        const fila = filas[a.alumno_id];
        const monto = Number(fila.monto);
        const { interesAtraso, interesLista, total } = calcularRecargo(fila);
        const pctCombinado = monto > 0 && total > 0 ? Math.round((total / monto) * 1000) / 10 : 0;
        const body = {
          alumno_id: a.alumno_id,
          fecha,
          monto,
          forma_de_pago: fila.forma,
          interes: total,
          interes_pct: pctCombinado,
          bonificacion: 0,
          nota: construirNota(nota, { loteId, interesAtraso, interesLista }),
        };
        const res = await fetch("/api/pagos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(`${a.alumno}: ${data.error || "No se pudo registrar el pago"}`);
        }
      }
      onRegistrado();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-neutral-800">
            Registrar pago grupal — {colegio}
          </p>
          <p className="text-xs text-neutral-500">
            {alumnos.length} integrante{alumnos.length !== 1 ? "s" : ""} seleccionado
            {alumnos.length !== 1 ? "s" : ""}. Dejá en $0 a quien no pagó en este cobro.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-500 hover:bg-white"
        >
          Cancelar
        </button>
      </div>

      <div className="thin-scroll max-h-72 space-y-2 overflow-auto rounded-lg bg-white p-2">
        {alumnos.map((a) => {
          const fila = filas[a.alumno_id];
          const recargo = calcularRecargo(fila);
          return (
            <div
              key={a.alumno_id}
              className="flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-2 last:border-0 last:pb-0"
            >
              <div className="min-w-[9rem] flex-1">
                <p className="text-sm font-medium text-neutral-800">{a.alumno}</p>
                <p className="text-[11px] text-neutral-400">Saldo planilla: {formatMoney(a.saldo_base)}</p>
              </div>
              <input
                type="number"
                min={0}
                step="any"
                value={fila.monto}
                onChange={(e) => actualizarFila(a.alumno_id, { monto: e.target.value })}
                className="w-28 rounded-md border border-neutral-300 p-2 text-sm"
                placeholder="$0"
              />
              <select
                value={fila.forma}
                onChange={(e) => actualizarFila(a.alumno_id, { forma: e.target.value })}
                className="w-36 rounded-md border border-neutral-300 p-2 text-sm"
              >
                {FORMAS_DE_PAGO.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <label
                className="flex items-center gap-1.5 text-xs text-neutral-500"
                title="Este integrante paga con el/los recargo(s) de abajo"
              >
                <input
                  type="checkbox"
                  checked={fila.aplicarRecargo}
                  onChange={(e) => actualizarFila(a.alumno_id, { aplicarRecargo: e.target.checked })}
                />
                Con recargo
              </label>
              {fila.aplicarRecargo && recargo.total > 0 && (
                <span className="text-xs font-medium text-amber-700">
                  +{formatMoney(recargo.total)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <label className="block text-xs text-neutral-500">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="mt-1 w-full max-w-[12rem] rounded-md border border-neutral-300 p-2 text-sm"
        />
      </div>

      {/* Recargos compartidos por todo el lote: cada integrante decide con su tilde "Con
          recargo" si se le aplica o no (algunos pagan con recargo, otros no). */}
      <div className="rounded-lg bg-white p-3">
        <p className="mb-2 text-xs font-semibold text-neutral-600">
          Recargos (opcionales — solo afectan a los integrantes tildados &quot;Con recargo&quot;)
        </p>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={atrasado} onChange={(e) => setAtrasado(e.target.checked)} />
          Pago atrasado — aplicar interés (%)
        </label>
        {atrasado && (
          <div className="mb-3 mt-1 pl-6">
            <input
              type="number"
              min={0}
              step="any"
              value={pctAtraso}
              onChange={(e) => setPctAtraso(e.target.value)}
              className="w-28 rounded-md border border-neutral-300 p-2 text-sm"
              placeholder="0"
            />
          </div>
        )}

        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={precioLista}
            onChange={(e) => setPrecioLista(e.target.checked)}
          />
          No pagó en efectivo — aplicar precio de lista (%)
        </label>
        {precioLista && (
          <div className="mt-1 pl-6">
            <input
              type="number"
              min={0}
              step="any"
              value={pctLista}
              onChange={(e) => setPctLista(e.target.value)}
              className="w-28 rounded-md border border-neutral-300 p-2 text-sm"
              placeholder="0"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-neutral-500">Nota (opcional, aplica a todo el lote)</label>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
          placeholder="Ej.: cobro grupal en reunión de padres"
        />
      </div>

      <div className="rounded-lg bg-emerald-700 p-3 text-white">
        <p className="text-xs text-emerald-100">
          {filasConMonto.length} pago{filasConMonto.length !== 1 ? "s" : ""} a registrar
        </p>
        <p className="text-xl font-bold">{formatMoney(totalMontos + totalRecargos)}</p>
        {totalRecargos > 0 && (
          <p className="text-xs text-emerald-100">
            (cuotas {formatMoney(totalMontos)} + recargos {formatMoney(totalRecargos)})
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving || filasConMonto.length === 0}
        className="btn btn-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        {saving ? "Guardando…" : `Registrar ${filasConMonto.length || ""} pago${filasConMonto.length !== 1 ? "s" : ""}`}
      </button>
    </form>
  );
}

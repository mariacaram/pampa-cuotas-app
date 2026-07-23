"use client";

import { useState } from "react";
import { FORMAS_DE_PAGO, formatMoney } from "@/lib/format";
import { NuevoPago } from "@/lib/types";

type Props = {
  alumnoId: string;
  montoCuota: number;
  cuotasRestantes: number;
  onRegistrado: () => void;
};

export default function PagoForm({ alumnoId, montoCuota, cuotasRestantes, onRegistrado }: Props) {
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [formaDePago, setFormaDePago] = useState(FORMAS_DE_PAGO[0]);
  const [atrasado, setAtrasado] = useState(false);
  const [interesPct, setInteresPct] = useState("");
  const [conBonificacion, setConBonificacion] = useState(false);
  const [bonificacion, setBonificacion] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct = Number(interesPct) || 0;
  const baseCuotas = Math.round(cantidadCuotas * montoCuota);
  const interesMonto = atrasado ? Math.round(baseCuotas * (pct / 100)) : 0;
  const totalReferencia = baseCuotas + interesMonto;
  const bonif = conBonificacion ? Number(bonificacion) || 0 : 0;
  const maxCuotas = Math.max(1, cuotasRestantes || 1);

  function elegirCuotas(n: number) {
    setCantidadCuotas(n);
    setMonto(String(Math.round(n * montoCuota)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setError("Ingresá un monto cobrado mayor a 0.");
      return;
    }
    setSaving(true);
    const body: NuevoPago = {
      alumno_id: alumnoId,
      fecha,
      monto: montoNum,
      forma_de_pago: formaDePago,
      interes: interesMonto,
      interes_pct: atrasado ? pct : 0,
      bonificacion: bonif,
      nota,
    };
    try {
      const res = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo registrar el pago");
      }
      setMonto("");
      setCantidadCuotas(1);
      setInteresPct("");
      setBonificacion("");
      setNota("");
      setAtrasado(false);
      setConBonificacion(false);
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
      className="space-y-3 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm"
    >
      <p className="text-sm font-semibold text-neutral-800">Registrar un pago</p>

      {cuotasRestantes > 0 && montoCuota > 0 && (
        <div className="rounded-lg bg-emerald-50/60 p-3">
          <label className="block text-xs text-neutral-500">¿Cuántas cuotas paga?</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {Array.from({ length: maxCuotas }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => elegirCuotas(n)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  cantidadCuotas === n
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {n}
              </button>
            ))}
            <span className="text-xs text-neutral-500">
              {cantidadCuotas} cuota{cantidadCuotas > 1 ? "s" : ""} × {formatMoney(montoCuota)} ={" "}
              <span className="font-semibold text-neutral-800">{formatMoney(baseCuotas)}</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Autocompleta el monto sugerido. Podés editarlo abajo (ej.: una seña de monto distinto).
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-neutral-500">Monto cobrado ($)</label>
          <input
            type="number"
            min={0}
            step="any"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Forma de pago</label>
          <select
            value={formaDePago}
            onChange={(e) => setFormaDePago(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
          >
            {FORMAS_DE_PAGO.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Interés por atraso (como %) */}
      <div className="rounded-lg bg-neutral-50 p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={atrasado} onChange={(e) => setAtrasado(e.target.checked)} />
          Pago atrasado — aplicar interés (%)
        </label>
        {atrasado && (
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-neutral-500">Interés (%)</label>
              <input
                type="number"
                min={0}
                step="any"
                value={interesPct}
                onChange={(e) => setInteresPct(e.target.value)}
                className="mt-1 w-28 rounded-md border border-neutral-300 p-2 text-sm"
                placeholder="0"
              />
            </div>
            <div className="text-xs text-neutral-600">
              <p>
                {cantidadCuotas} cuota{cantidadCuotas > 1 ? "s" : ""}: {formatMoney(baseCuotas)}
              </p>
              <p>Interés ({pct}%): {formatMoney(interesMonto)}</p>
              <p className="font-semibold text-emerald-800">
                Total de referencia: {formatMoney(totalReferencia)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bonificación otorgada */}
      <div className="rounded-lg bg-neutral-50 p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={conBonificacion}
            onChange={(e) => setConBonificacion(e.target.checked)}
          />
          Otorgar una bonificación / descuento
        </label>
        {conBonificacion && (
          <div className="mt-2">
            <label className="block text-xs text-neutral-500">Monto bonificado ($)</label>
            <input
              type="number"
              min={0}
              step="any"
              value={bonificacion}
              onChange={(e) => setBonificacion(e.target.value)}
              className="mt-1 w-40 rounded-md border border-neutral-300 p-2 text-sm"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-neutral-400">
              Queda registrado como bonificación otorgada (aparece en el Control de caja).
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-neutral-500">Nota (opcional)</label>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
          placeholder="Ej.: pagó la 3° cuota"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        {saving ? "Guardando…" : "Registrar pago"}
      </button>
    </form>
  );
}

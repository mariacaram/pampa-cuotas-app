"use client";

import { useState } from "react";
import { FORMAS_DE_PAGO, formatMoney, construirNota } from "@/lib/format";
import { NuevoPago } from "@/lib/types";

type Props = {
  alumnoId: string;
  montoCuota: number;
  cuotasRestantes: number;
  onRegistrado: () => void;
};

type Linea = { monto: string; forma: string };

function nuevaLinea(forma: string): Linea {
  return { monto: "", forma };
}

export default function PagoForm({ alumnoId, montoCuota, cuotasRestantes, onRegistrado }: Props) {
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea(FORMAS_DE_PAGO[0])]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [atrasado, setAtrasado] = useState(false);
  const [interesPct, setInteresPct] = useState("");
  const [conBonificacion, setConBonificacion] = useState(false);
  const [bonificacion, setBonificacion] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct = Number(interesPct) || 0;
  const baseCuotas = Math.round(cantidadCuotas * montoCuota);
  // El interés se calcula sobre la SUMA de lo cargado en todas las líneas (lo realmente
  // cobrado), no sobre el valor sugerido de la cuota.
  const montoTotalIngresado = lineas.reduce((acc, l) => acc + (Number(l.monto) || 0), 0);
  const interesMonto = atrasado ? Math.round(montoTotalIngresado * (pct / 100)) : 0;
  const totalReferencia = montoTotalIngresado + interesMonto;
  const bonif = conBonificacion ? Number(bonificacion) || 0 : 0;
  const maxCuotas = Math.max(1, cuotasRestantes || 1);

  function elegirCuotas(n: number) {
    setCantidadCuotas(n);
    setLineas((prev) => {
      const copia = [...prev];
      copia[0] = { ...copia[0], monto: String(Math.round(n * montoCuota)) };
      return copia;
    });
  }

  function actualizarLinea(i: number, campo: keyof Linea, valor: string) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }

  function agregarLinea() {
    // Sugiere una forma de pago distinta a la última cargada, para que sea rápido de tildar.
    const ultima = lineas[lineas.length - 1]?.forma;
    const sugerida = FORMAS_DE_PAGO.find((f) => f !== ultima) || FORMAS_DE_PAGO[0];
    setLineas((prev) => [...prev, nuevaLinea(sugerida)]);
  }

  function quitarLinea(i: number) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function resetForm() {
    setLineas([nuevaLinea(FORMAS_DE_PAGO[0])]);
    setCantidadCuotas(1);
    setInteresPct("");
    setBonificacion("");
    setNota("");
    setAtrasado(false);
    setConBonificacion(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lineasValidas = lineas
      .map((l) => ({ monto: Number(l.monto), forma: l.forma }))
      .filter((l) => Number.isFinite(l.monto) && l.monto > 0);

    if (lineasValidas.length === 0) {
      setError("Ingresá al menos un monto cobrado mayor a 0.");
      return;
    }

    setSaving(true);
    try {
      // Cada línea (monto + forma de pago) se registra como un pago aparte, para que quede
      // discriminado en Control de caja cuánto entró por cada medio. El interés y la
      // bonificación (si corresponden) se cargan en la última línea, junto con la nota.
      // Si hay más de una línea, comparten un ID de grupo (guardado dentro de la nota, ver
      // construirNota) para poder anularlas todas juntas más adelante — es un solo cobro
      // dividido, no pagos independientes.
      const grupoId = lineasValidas.length > 1 ? crypto.randomUUID() : undefined;
      for (let i = 0; i < lineasValidas.length; i++) {
        const esUltima = i === lineasValidas.length - 1;
        const body: NuevoPago = {
          alumno_id: alumnoId,
          fecha,
          monto: lineasValidas[i].monto,
          forma_de_pago: lineasValidas[i].forma,
          interes: esUltima ? interesMonto : 0,
          interes_pct: esUltima && atrasado ? pct : 0,
          bonificacion: esUltima ? bonif : 0,
          nota: construirNota(esUltima ? nota : "", grupoId),
        };
        const res = await fetch("/api/pagos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo registrar el pago");
        }
      }
      resetForm();
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
            Autocompleta el monto sugerido en la primera línea. Podés editarlo abajo, o dividirlo
            en varias formas de pago (ej.: una parte en efectivo y otra por transferencia).
          </p>
        </div>
      )}

      {/* Líneas de monto + forma de pago (se pueden dividir en varias) */}
      <div className="space-y-2">
        <label className="block text-xs text-neutral-500">Monto cobrado y forma de pago</label>
        {lineas.map((linea, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="any"
              value={linea.monto}
              onChange={(e) => actualizarLinea(i, "monto", e.target.value)}
              className="w-full rounded-md border border-neutral-300 p-2 text-sm sm:max-w-[10rem]"
              placeholder="0"
            />
            <select
              value={linea.forma}
              onChange={(e) => actualizarLinea(i, "forma", e.target.value)}
              className="w-full rounded-md border border-neutral-300 p-2 text-sm"
            >
              {FORMAS_DE_PAGO.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            {lineas.length > 1 && (
              <button
                type="button"
                onClick={() => quitarLinea(i)}
                className="shrink-0 rounded-md border border-neutral-300 px-2 py-2 text-xs text-neutral-500 hover:bg-neutral-50"
                title="Quitar esta línea"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={agregarLinea}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          + Dividir en otra forma de pago
        </button>
        {lineas.length > 1 && (
          <p className="text-xs text-neutral-500">
            Total entre todas las líneas:{" "}
            <span className="font-semibold text-neutral-800">{formatMoney(montoTotalIngresado)}</span>
          </p>
        )}
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
              <p>Monto cobrado: {formatMoney(montoTotalIngresado)}</p>
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
        className="btn btn-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        {saving ? "Guardando…" : "Registrar pago"}
      </button>
    </form>
  );
}

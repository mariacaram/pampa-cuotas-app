"use client";

import { useState } from "react";
import { AlumnoBase, CuotaPlan } from "@/lib/types";
import { FORMAS_DE_PAGO, formatMoney, construirNota } from "@/lib/format";

type Integrante = { alumno: AlumnoBase; cuotas: CuotaPlan[] }; // cuotas = las tildadas (chips)

type Props = {
  colegio: string;
  integrantes: Integrante[];
  onRegistrado: () => void;
  onCancel: () => void;
};

type Fila = { forma: string; aplicarRecargo: boolean };

function filaInicial(): Fila {
  return { forma: FORMAS_DE_PAGO[0], aplicarRecargo: false };
}

// Pago grupal: una institución paga junto la cuota de varios alumnos. Las cuotas de cada
// integrante ya vienen elegidas (tildadas como "chips" en la tabla de CuotasView) — acá solo se
// elige la forma de pago y si corresponde recargo. Cada integrante queda como un pago
// independiente (se puede anular uno sin tocar a los demás), pero todos comparten un loteId
// escondido en la nota (ver construirNota/parseNota) para poder verlos juntos — ver "Pagos
// grupales" más abajo en esta misma pantalla.
export default function PagoGrupalForm({ colegio, integrantes, onRegistrado, onCancel }: Props) {
  const [filas, setFilas] = useState<Record<string, Fila>>(() =>
    Object.fromEntries(integrantes.map((i) => [i.alumno.alumno_id, filaInicial()]))
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
    setFilas((prev) => ({ ...prev, [alumnoId]: { ...(prev[alumnoId] ?? filaInicial()), ...cambios } }));
  }

  // Recargo de UN integrante: el de atraso SOLO se aplica sobre la parte de sus cuotas
  // tildadas que está VENCIDA (nunca sobre una cuota que todavía no venció); el de "no
  // efectivo" (precio de lista), si corresponde, se aplica sobre el total ya con ese atraso —
  // misma cadena y misma regla "solo lo vencido" que en la ficha individual del alumno.
  function calcularIntegrante(i: Integrante) {
    const fila = filas[i.alumno.alumno_id] ?? filaInicial();
    const base = i.cuotas.reduce((acc, c) => acc + c.monto, 0);
    const baseVencida = i.cuotas.filter((c) => c.estado === "vencida").reduce((acc, c) => acc + c.monto, 0);
    const restoSinVencer = base - baseVencida;
    if (!fila.aplicarRecargo || base <= 0) {
      return { base, interesAtraso: 0, interesLista: 0, total: base };
    }
    const conAtraso = atrasado ? baseVencida * (1 + numAtraso / 100) + restoSinVencer : base;
    const final = precioLista ? conAtraso * (1 + numLista / 100) : conAtraso;
    return {
      base,
      interesAtraso: Math.round(conAtraso - base),
      interesLista: Math.round(final - conAtraso),
      total: Math.round(final),
    };
  }

  const conCuotas = integrantes.filter((i) => i.cuotas.length > 0);
  const calculos = new Map(conCuotas.map((i) => [i.alumno.alumno_id, calcularIntegrante(i)]));
  const totalBase = conCuotas.reduce((acc, i) => acc + (calculos.get(i.alumno.alumno_id)?.base ?? 0), 0);
  const totalRecargos = conCuotas.reduce((acc, i) => {
    const c = calculos.get(i.alumno.alumno_id);
    return acc + (c ? c.interesAtraso + c.interesLista : 0);
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (conCuotas.length === 0) {
      setError("Tildá al menos una cuota de algún integrante.");
      return;
    }

    setSaving(true);
    try {
      const loteId = crypto.randomUUID();
      for (const i of conCuotas) {
        const fila = filas[i.alumno.alumno_id] ?? filaInicial();
        const { base, interesAtraso, interesLista, total } = calculos.get(i.alumno.alumno_id)!;
        const pctCombinado = base > 0 && total !== base ? Math.round(((total - base) / base) * 1000) / 10 : 0;
        const body = {
          alumno_id: i.alumno.alumno_id,
          fecha,
          monto: base,
          forma_de_pago: fila.forma,
          interes: interesAtraso + interesLista,
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
          throw new Error(`${i.alumno.alumno}: ${data.error || "No se pudo registrar el pago"}`);
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
            {integrantes.length} integrante{integrantes.length !== 1 ? "s" : ""} seleccionado
            {integrantes.length !== 1 ? "s" : ""}. Las cuotas de cada uno se eligen tocando sus
            píldoras en la lista de arriba.
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
        {integrantes.map((i) => {
          const fila = filas[i.alumno.alumno_id] ?? filaInicial();
          const calc = calculos.get(i.alumno.alumno_id);
          const sinCuotas = i.cuotas.length === 0;
          return (
            <div
              key={i.alumno.alumno_id}
              className={`flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-2 last:border-0 last:pb-0 ${
                sinCuotas ? "opacity-40" : ""
              }`}
            >
              <div className="min-w-[9rem] flex-1">
                <p className="text-sm font-medium text-neutral-800">{i.alumno.alumno}</p>
                <p className="text-[11px] text-neutral-400">
                  {sinCuotas
                    ? "Sin cuotas tildadas"
                    : `Cuota${i.cuotas.length > 1 ? "s" : ""} ${i.cuotas.map((c) => c.numero + "°").join(", ")}: ${formatMoney(calc?.base ?? 0)}`}
                </p>
              </div>
              <select
                value={fila.forma}
                onChange={(e) => actualizarFila(i.alumno.alumno_id, { forma: e.target.value })}
                disabled={sinCuotas}
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
                title="Este integrante paga con el/los recargo(s) de abajo (solo se aplica a la parte vencida)"
              >
                <input
                  type="checkbox"
                  checked={fila.aplicarRecargo}
                  disabled={sinCuotas}
                  onChange={(e) => actualizarFila(i.alumno.alumno_id, { aplicarRecargo: e.target.checked })}
                />
                Con recargo
              </label>
              {!sinCuotas && calc && calc.total !== calc.base && (
                <span className="text-xs font-medium text-amber-700">
                  → {formatMoney(calc.total)}
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
          recargo" si se le aplica o no. El de atraso SOLO afecta la parte de sus cuotas que
          está vencida, nunca la que todavía no vence. */}
      <div className="rounded-lg bg-white p-3">
        <p className="mb-2 text-xs font-semibold text-neutral-600">
          Recargos (opcionales — solo afectan a los integrantes tildados &quot;Con recargo&quot;, y el
          de atraso solo a sus cuotas vencidas)
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
          {conCuotas.length} pago{conCuotas.length !== 1 ? "s" : ""} a registrar
        </p>
        <p className="text-xl font-bold">{formatMoney(totalBase + totalRecargos)}</p>
        {totalRecargos > 0 && (
          <p className="text-xs text-emerald-100">
            (cuotas {formatMoney(totalBase)} + recargos {formatMoney(totalRecargos)})
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving || conCuotas.length === 0}
        className="btn btn-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        {saving ? "Guardando…" : `Registrar ${conCuotas.length || ""} pago${conCuotas.length !== 1 ? "s" : ""}`}
      </button>
    </form>
  );
}

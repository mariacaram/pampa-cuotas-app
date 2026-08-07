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

// Cada línea es un monto + una forma de pago. `paraInteres` es el tilde que decide si ESE
// monto entra en la base sobre la que se calculan los recargos (útil cuando se divide un
// cobro: ej. el recargo por "no efectivo" solo debería aplicar a la parte en transferencia,
// no a la parte en efectivo).
type Linea = { monto: string; forma: string; paraInteres: boolean };

function nuevaLinea(forma: string): Linea {
  return { monto: "", forma, paraInteres: false };
}

export default function PagoForm({ alumnoId, montoCuota, cuotasRestantes, onRegistrado }: Props) {
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea(FORMAS_DE_PAGO[0])]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [atrasado, setAtrasado] = useState(false);
  const [pctAtraso, setPctAtraso] = useState("");
  const [precioLista, setPrecioLista] = useState(false);
  const [pctLista, setPctLista] = useState("");
  const [conBonificacion, setConBonificacion] = useState(false);
  const [bonificacion, setBonificacion] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseCuotas = Math.round(cantidadCuotas * montoCuota);
  const montoTotalIngresado = lineas.reduce((acc, l) => acc + (Number(l.monto) || 0), 0);

  // Base de cálculo: SOLO la suma de las líneas con el tilde "aplicar recargo" activado.
  const baseInteres = lineas.reduce(
    (acc, l) => acc + (l.paraInteres ? Number(l.monto) || 0 : 0),
    0
  );
  // Los dos recargos se aplican EN CADENA, no por separado: primero el de atraso sobre la
  // base, y sobre ESE resultado (no sobre la base original) el de precio de lista. Los dos
  // son opcionales — si no se tilda ninguno, no se cobra ningún recargo.
  const numAtraso = Number(pctAtraso) || 0;
  const numLista = Number(pctLista) || 0;
  const conAtraso = atrasado ? baseInteres * (1 + numAtraso / 100) : baseInteres;
  const conListaYAtraso = precioLista ? conAtraso * (1 + numLista / 100) : conAtraso;
  const interesMonto = Math.round(conListaYAtraso - baseInteres);
  // Desglose de a cuánto corresponde cada recargo (se guarda escondido en la nota, ver
  // construirNota) para poder discriminarlos después en las estadísticas del alumno.
  const interesAtrasoMonto = Math.round(conAtraso - baseInteres);
  const interesListaMonto = Math.round(conListaYAtraso - conAtraso);
  // % combinado real, solo para guardar como referencia (no se usa en ningún cálculo).
  const pctCombinado = baseInteres > 0 ? Math.round((interesMonto / baseInteres) * 1000) / 10 : 0;
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

  function actualizarLinea(i: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
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
    setPctAtraso("");
    setPctLista("");
    setBonificacion("");
    setNota("");
    setAtrasado(false);
    setPrecioLista(false);
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
      // discriminado en Control de caja cuánto entró por cada medio. El interés (recargos
      // combinados) y la bonificación se cargan en la última línea, junto con la nota.
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
          interes_pct: esUltima ? pctCombinado : 0,
          bonificacion: esUltima ? bonif : 0,
          nota: construirNota(esUltima ? nota : "", {
            grupoId,
            interesAtraso: esUltima ? interesAtrasoMonto : 0,
            interesLista: esUltima ? interesListaMonto : 0,
          }),
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
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              step="any"
              value={linea.monto}
              onChange={(e) => actualizarLinea(i, { monto: e.target.value })}
              className="w-full rounded-md border border-neutral-300 p-2 text-sm sm:max-w-[10rem]"
              placeholder="0"
            />
            <select
              value={linea.forma}
              onChange={(e) => actualizarLinea(i, { forma: e.target.value })}
              className="w-full rounded-md border border-neutral-300 p-2 text-sm sm:max-w-[10rem]"
            >
              {FORMAS_DE_PAGO.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-neutral-500" title="Este monto se suma a la base sobre la que se calculan los recargos de abajo">
              <input
                type="checkbox"
                checked={linea.paraInteres}
                onChange={(e) => actualizarLinea(i, { paraInteres: e.target.checked })}
              />
              Aplicar recargo a este monto
            </label>
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

      {/* Recargos: atraso y precio de lista (no efectivo). Los dos son opcionales — a veces
          no se cobra esa diferencia — y si se tildan los dos, se aplican en cadena: primero
          atraso, después precio de lista sobre ese resultado. */}
      <div className="rounded-lg bg-neutral-50 p-3">
        <p className="mb-2 text-xs font-semibold text-neutral-600">
          Recargos (opcionales, se aplican sobre las líneas tildadas &quot;Aplicar recargo&quot;)
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

        {(atrasado || precioLista) && (
          <div className="mt-3 border-t border-neutral-200 pt-2 text-xs text-neutral-600">
            <p>Monto con recargo ({formatMoney(baseInteres)}):</p>
            {atrasado && <p>&nbsp;&nbsp;+ Atraso ({numAtraso}%): {formatMoney(baseInteres * (numAtraso / 100))}</p>}
            {precioLista && (
              <p>&nbsp;&nbsp;+ Precio de lista ({numLista}%, sobre el monto ya con atraso): {formatMoney(conAtraso * (numLista / 100))}</p>
            )}
            <p>Recargo total: {formatMoney(interesMonto)}</p>
            <p className="font-semibold text-emerald-800">
              Total de referencia (todas las líneas + recargo): {formatMoney(totalReferencia)}
            </p>
            {baseInteres === 0 && (
              <p className="mt-1 text-amber-600">
                Ningún monto tiene tildado &quot;Aplicar recargo&quot; — no se va a cobrar nada extra.
              </p>
            )}
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

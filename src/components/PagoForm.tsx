"use client";

import { useEffect, useState } from "react";
import { FORMAS_DE_PAGO, formatDate, formatMoney, construirNota } from "@/lib/format";
import { CuotaPlan, NuevoPago } from "@/lib/types";

type Props = {
  alumnoId: string;
  // Cuotas TODAVÍA NO pagadas (de alumno.cuotasPlan, sin las "pagada"), en orden. Se eligen
  // tildando, nunca escribiendo un monto a mano — así no se puede cargar un importe que no
  // corresponda a ninguna cuota real.
  cuotasPendientes: CuotaPlan[];
  onRegistrado: () => void;
};

// Estado de recargo de UNA cuota tildada. Cada cuota tiene su propio tilde+% de atraso (solo
// tiene sentido si está vencida) y su propio tilde+% de "no pagó en efectivo" — dos cuotas
// tildadas juntas pueden llevar recargos distintos (ej. la vencida con atraso, la que no venció
// sin ningún recargo).
type FilaCuota = {
  tildada: boolean;
  atrasado: boolean;
  pctAtraso: string;
  noEfectivo: boolean;
  pctNoEfectivo: string;
};

function filaVacia(): FilaCuota {
  return { tildada: false, atrasado: false, pctAtraso: "", noEfectivo: false, pctNoEfectivo: "" };
}

// Una línea de cobro: monto + forma de pago (para poder discriminar en Control de caja cuánto
// entró en efectivo vs. transferencia, etc.). El TOTAL de las líneas tiene que coincidir con el
// total de las cuotas tildadas — acá no se "inventa" un monto, solo se reparte entre formas de
// pago el que ya salió de la selección de cuotas.
type Linea = { monto: string; forma: string };

function nuevaLinea(forma: string): Linea {
  return { monto: "", forma };
}

export default function PagoForm({ alumnoId, cuotasPendientes, onRegistrado }: Props) {
  const [filasCuota, setFilasCuota] = useState<Record<number, FilaCuota>>(() =>
    Object.fromEntries(cuotasPendientes.map((c) => [c.numero, filaVacia()]))
  );
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea(FORMAS_DE_PAGO[0])]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [conBonificacion, setConBonificacion] = useState(false);
  const [bonificacion, setBonificacion] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function actualizarFilaCuota(numero: number, cambios: Partial<FilaCuota>) {
    setFilasCuota((prev) => ({ ...prev, [numero]: { ...(prev[numero] ?? filaVacia()), ...cambios } }));
  }

  // Recargo de UNA cuota puntual: primero atraso, y sobre ESE resultado (no sobre el original)
  // el de no-efectivo — misma cadena que en el resto de la app.
  function calcularCuota(c: CuotaPlan) {
    const fila = filasCuota[c.numero] ?? filaVacia();
    const base = c.monto;
    const conAtraso =
      fila.atrasado && c.estado === "vencida" ? base * (1 + (Number(fila.pctAtraso) || 0) / 100) : base;
    const final = fila.noEfectivo ? conAtraso * (1 + (Number(fila.pctNoEfectivo) || 0) / 100) : conAtraso;
    return {
      base,
      interesAtraso: Math.round(conAtraso - base),
      interesLista: Math.round(final - conAtraso),
      total: Math.round(final),
    };
  }

  const cuotasTildadas = cuotasPendientes.filter((c) => filasCuota[c.numero]?.tildada);
  const detalleCuotas = cuotasTildadas.map((c) => ({ c, calc: calcularCuota(c) }));
  const totalBase = detalleCuotas.reduce((acc, d) => acc + d.calc.base, 0);
  const totalInteresAtraso = detalleCuotas.reduce((acc, d) => acc + d.calc.interesAtraso, 0);
  const totalInteresLista = detalleCuotas.reduce((acc, d) => acc + d.calc.interesLista, 0);
  const totalConRecargo = Math.round(totalBase + totalInteresAtraso + totalInteresLista);
  const pctCombinado =
    totalBase > 0 ? Math.round(((totalInteresAtraso + totalInteresLista) / totalBase) * 1000) / 10 : 0;

  const montoTotalIngresado = lineas.reduce((acc, l) => acc + (Number(l.monto) || 0), 0);
  const diferencia = Math.round(totalConRecargo - montoTotalIngresado);

  // Mientras haya una sola línea (todavía no dividió el cobro), la mantenemos sincronizada con
  // el total de las cuotas tildadas — así no tiene que copiar el número a mano. En cuanto
  // divide en más de una línea, dejamos de tocarlas: a partir de ahí reparte ella.
  useEffect(() => {
    if (lineas.length === 1) {
      const actual = Number(lineas[0].monto) || 0;
      if (actual !== totalConRecargo) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLineas([{ ...lineas[0], monto: totalConRecargo > 0 ? String(totalConRecargo) : "" }]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalConRecargo]);

  function actualizarLinea(i: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  function agregarLinea() {
    const ultima = lineas[lineas.length - 1]?.forma;
    const sugerida = FORMAS_DE_PAGO.find((f) => f !== ultima) || FORMAS_DE_PAGO[0];
    setLineas((prev) => [...prev, nuevaLinea(sugerida)]);
  }

  function quitarLinea(i: number) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const bonif = conBonificacion ? Number(bonificacion) || 0 : 0;

  function resetForm() {
    setFilasCuota(Object.fromEntries(cuotasPendientes.map((c) => [c.numero, filaVacia()])));
    setLineas([nuevaLinea(FORMAS_DE_PAGO[0])]);
    setBonificacion("");
    setNota("");
    setConBonificacion(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (cuotasTildadas.length === 0) {
      setError("Tildá al menos una cuota.");
      return;
    }

    const lineasValidas = lineas
      .map((l) => ({ monto: Number(l.monto), forma: l.forma }))
      .filter((l) => Number.isFinite(l.monto) && l.monto > 0);

    if (lineasValidas.length === 0) {
      setError("Ingresá al menos un monto cobrado mayor a 0.");
      return;
    }
    if (Math.abs(diferencia) >= 1) {
      setError(
        diferencia > 0
          ? `Faltan ${formatMoney(diferencia)} para completar el total de las cuotas tildadas.`
          : `Sobran ${formatMoney(-diferencia)}: el total de las líneas no puede superar el de las cuotas tildadas.`
      );
      return;
    }

    setSaving(true);
    try {
      // Cada línea (monto + forma de pago) se registra como un pago aparte, para que quede
      // discriminado en Control de caja. El interés (recargos de las cuotas tildadas) y la
      // bonificación se cargan en la última línea, junto con la nota. Si hay más de una línea,
      // comparten un ID de grupo (guardado dentro de la nota) para poder anularlas todas juntas
      // más adelante — es un solo cobro dividido, no pagos independientes.
      const grupoId = lineasValidas.length > 1 ? crypto.randomUUID() : undefined;
      for (let i = 0; i < lineasValidas.length; i++) {
        const esUltima = i === lineasValidas.length - 1;
        const body: NuevoPago = {
          alumno_id: alumnoId,
          fecha,
          monto: lineasValidas[i].monto,
          forma_de_pago: lineasValidas[i].forma,
          interes: esUltima ? totalInteresAtraso + totalInteresLista : 0,
          interes_pct: esUltima ? pctCombinado : 0,
          bonificacion: esUltima ? bonif : 0,
          nota: construirNota(esUltima ? nota : "", {
            grupoId,
            interesAtraso: esUltima ? totalInteresAtraso : 0,
            interesLista: esUltima ? totalInteresLista : 0,
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

      {cuotasPendientes.length === 0 ? (
        <p className="text-sm text-neutral-400">Este alumno no tiene cuotas pendientes.</p>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs text-neutral-500">¿Qué cuotas está pagando?</label>
          {cuotasPendientes.map((c) => {
            const fila = filasCuota[c.numero] ?? filaVacia();
            const calc = calcularCuota(c);
            return (
              <div
                key={c.numero}
                className={`rounded-lg border p-2.5 ${
                  fila.tildada ? "border-emerald-300 bg-emerald-50/50" : "border-neutral-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fila.tildada}
                    onChange={(e) => actualizarFilaCuota(c.numero, { tildada: e.target.checked })}
                  />
                  <span className="font-medium text-neutral-800">{c.numero}°</span>
                  <span className="text-xs text-neutral-500">
                    Vence {c.vencimiento ? formatDate(c.vencimiento) : "—"}
                  </span>
                  <span className="text-sm font-semibold text-neutral-800">{formatMoney(c.monto)}</span>
                  {c.estado === "vencida" && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      Vencida
                    </span>
                  )}
                  {fila.tildada && calc.total !== calc.base && (
                    <span className="ml-auto text-xs font-semibold text-emerald-800">
                      → {formatMoney(calc.total)} con recargo
                    </span>
                  )}
                </div>

                {fila.tildada && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-6">
                    {c.estado === "vencida" && (
                      <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <input
                          type="checkbox"
                          checked={fila.atrasado}
                          onChange={(e) => actualizarFilaCuota(c.numero, { atrasado: e.target.checked })}
                        />
                        Atraso (%)
                        {fila.atrasado && (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={fila.pctAtraso}
                            onChange={(e) => actualizarFilaCuota(c.numero, { pctAtraso: e.target.value })}
                            className="w-16 rounded-md border border-neutral-300 p-1 text-xs"
                            placeholder="0"
                          />
                        )}
                      </label>
                    )}
                    <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                      <input
                        type="checkbox"
                        checked={fila.noEfectivo}
                        onChange={(e) => actualizarFilaCuota(c.numero, { noEfectivo: e.target.checked })}
                      />
                      No efectivo (%)
                      {fila.noEfectivo && (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={fila.pctNoEfectivo}
                          onChange={(e) => actualizarFilaCuota(c.numero, { pctNoEfectivo: e.target.value })}
                          className="w-16 rounded-md border border-neutral-300 p-1 text-xs"
                          placeholder="0"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          {cuotasTildadas.length > 0 && (
            <p className="text-sm text-neutral-700">
              Total de las cuotas tildadas: <b>{formatMoney(totalConRecargo)}</b>
              {totalInteresAtraso + totalInteresLista > 0 && (
                <span className="text-neutral-500">
                  {" "}
                  (cuotas {formatMoney(totalBase)} + recargos {formatMoney(totalInteresAtraso + totalInteresLista)})
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Líneas de monto + forma de pago (repartir el total entre formas de pago) */}
      {cuotasTildadas.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs text-neutral-500">Forma de pago (repartí el total si hace falta)</label>
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
          <p className={`text-xs ${diferencia === 0 ? "text-neutral-500" : "text-amber-600"}`}>
            Total entre líneas: {formatMoney(montoTotalIngresado)}
            {diferencia !== 0 &&
              (diferencia > 0
                ? ` — faltan ${formatMoney(diferencia)}`
                : ` — sobran ${formatMoney(-diferencia)}`)}
          </p>
        </div>
      )}

      <div>
        <label className="block text-xs text-neutral-500">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="mt-1 w-full max-w-[12rem] rounded-md border border-neutral-300 p-2 text-sm"
        />
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
        disabled={saving || cuotasTildadas.length === 0}
        className="btn btn-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        {saving ? "Guardando…" : "Registrar pago"}
      </button>
    </form>
  );
}

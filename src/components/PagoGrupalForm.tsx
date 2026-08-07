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

// Línea de forma de pago del TOTAL del lote (no de un integrante puntual) — ej.: "$100.000
// Efectivo" + "$46.000 Transferencia". No hace falta elegir la forma de cada integrante: se
// arma un solo total y, si hace falta, se reparte entre formas de pago después.
type LineaPago = { monto: string; forma: string };

function nuevaLinea(forma: string): LineaPago {
  return { monto: "", forma };
}

// Pago grupal: una institución paga junto la cuota de varios alumnos. Las cuotas de cada
// integrante ya vienen elegidas (tildadas como "chips" en la tabla de CuotasView). Acá:
//   1. Por integrante, solo se decide si tiene recargo por ATRASO (se aplica nada más a la
//      parte de sus cuotas tildadas que está vencida) — no se elige forma de pago individual.
//   2. Se ve el total del lote (cuotas + atrasos) y recién ahí se puede dividir en formas de
//      pago (efectivo/transferencia/etc.), con el total como tope fijo.
//   3. El recargo por NO PAGAR EN EFECTIVO se aplica sobre la parte del total que quedó en
//      líneas no-efectivo, DESPUÉS de armar esa división — es el único recargo que se calcula
//      ahí abajo, no por integrante.
// Cada integrante queda como uno o más pagos independientes (se puede anular sin tocar a los
// demás), todos comparten un loteId escondido en la nota — ver "Pagos grupales" más abajo.
export default function PagoGrupalForm({ colegio, integrantes, onRegistrado, onCancel }: Props) {
  const [filasRecargo, setFilasRecargo] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(integrantes.map((i) => [i.alumno.alumno_id, false]))
  );
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [atrasado, setAtrasado] = useState(false);
  const [pctAtraso, setPctAtraso] = useState("");
  const [lineasPago, setLineasPago] = useState<LineaPago[]>([nuevaLinea(FORMAS_DE_PAGO[0])]);
  const [noEfectivo, setNoEfectivo] = useState(false);
  const [pctNoEfectivo, setPctNoEfectivo] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAtraso = Number(pctAtraso) || 0;
  const numNoEfectivo = Number(pctNoEfectivo) || 0;

  // Recargo por ATRASO de un integrante — solo sobre la parte de sus cuotas tildadas que está
  // vencida; el resto de sus cuotas (no vencidas) va sin recargo.
  function calcularAtraso(i: Integrante) {
    const base = i.cuotas.reduce((acc, c) => acc + c.monto, 0);
    const baseVencida = i.cuotas.filter((c) => c.estado === "vencida").reduce((acc, c) => acc + c.monto, 0);
    const restoSinVencer = base - baseVencida;
    const aplicar = atrasado && (filasRecargo[i.alumno.alumno_id] ?? false);
    const conAtraso = aplicar ? baseVencida * (1 + numAtraso / 100) + restoSinVencer : base;
    return { base, interesAtraso: Math.round(conAtraso - base), subtotal: Math.round(conAtraso) };
  }

  const conCuotas = integrantes.filter((i) => i.cuotas.length > 0);
  const atrasos = new Map(conCuotas.map((i) => [i.alumno.alumno_id, calcularAtraso(i)]));
  const totalBase = conCuotas.reduce((acc, i) => acc + (atrasos.get(i.alumno.alumno_id)?.base ?? 0), 0);
  const totalInteresAtraso = conCuotas.reduce(
    (acc, i) => acc + (atrasos.get(i.alumno.alumno_id)?.interesAtraso ?? 0),
    0
  );
  // Total a pagar = todas las cuotas tildadas + los recargos por atraso — este es el tope fijo
  // que tienen que sumar las líneas de forma de pago de abajo.
  const totalAPagar = totalBase + totalInteresAtraso;

  function actualizarLinea(i: number, cambios: Partial<LineaPago>) {
    setLineasPago((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  function agregarLinea() {
    const ultima = lineasPago[lineasPago.length - 1]?.forma;
    const sugerida = FORMAS_DE_PAGO.find((f) => f !== ultima) || FORMAS_DE_PAGO[0];
    setLineasPago((prev) => [...prev, nuevaLinea(sugerida)]);
  }

  function quitarLinea(i: number) {
    setLineasPago((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const montoTotalIngresado = lineasPago.reduce((acc, l) => acc + (Number(l.monto) || 0), 0);
  const diferencia = Math.round(totalAPagar - montoTotalIngresado);

  // Recargo por NO PAGAR EN EFECTIVO: se aplica sobre la suma de las líneas que NO son
  // "Efectivo", después de armar la división — no por integrante.
  const baseNoEfectivo = lineasPago
    .filter((l) => l.forma.trim().toLowerCase() !== "efectivo")
    .reduce((acc, l) => acc + (Number(l.monto) || 0), 0);
  const interesNoEfectivo = noEfectivo ? Math.round(baseNoEfectivo * (numNoEfectivo / 100)) : 0;
  const totalACobrar = montoTotalIngresado + interesNoEfectivo;

  // Una porción de pago ya asignada a un integrante y una forma de pago concreta.
  type ParteCreada = {
    alumnoId: string;
    alumnoNombre: string;
    forma: string;
    monto: number;
    grupoId?: string;
    interesAtraso: number;
    interesLista: number;
  };

  // Reparte el total de cada integrante (con su atraso ya adentro) entre las líneas de forma de
  // pago, EN ORDEN: llena la primera línea hasta agotarla, sigue con la próxima, etc. Si el
  // corte de una línea cae en el medio del monto de un integrante, ESE integrante queda partido
  // en más de un pago (comparten un grupoId propio, como un cobro dividido normal — se anulan
  // juntos). El interés por atraso de cada integrante se carga en SU última parte. El interés
  // por no-efectivo (uno solo para todo el lote) se busca de atrás para adelante y se carga en
  // la última parte de TODO el lote que sea no-efectivo, sea de quien sea — así nunca se pierde
  // aunque la línea no-efectivo no sea la última que se cargó en el formulario.
  function armarPartes(): ParteCreada[] {
    const todas: ParteCreada[] = [];
    let lineaIdx = 0;
    let restanteLinea = Number(lineasPago[0]?.monto) || 0;
    for (const i of conCuotas) {
      let restante = atrasos.get(i.alumno.alumno_id)!.subtotal;
      const propias: ParteCreada[] = [];
      while (restante > 0.001 && lineaIdx < lineasPago.length) {
        const tomar = Math.min(restante, restanteLinea);
        if (tomar > 0.001) {
          propias.push({
            alumnoId: i.alumno.alumno_id,
            alumnoNombre: i.alumno.alumno,
            forma: lineasPago[lineaIdx].forma,
            monto: Math.round(tomar),
            interesAtraso: 0,
            interesLista: 0,
          });
          restante -= tomar;
          restanteLinea -= tomar;
        }
        if (restanteLinea <= 0.001) {
          lineaIdx++;
          restanteLinea = Number(lineasPago[lineaIdx]?.monto) || 0;
        }
      }
      if (propias.length > 1) {
        const gid = crypto.randomUUID();
        for (const p of propias) p.grupoId = gid;
      }
      if (propias.length > 0) {
        propias[propias.length - 1].interesAtraso = atrasos.get(i.alumno.alumno_id)!.interesAtraso;
      }
      todas.push(...propias);
    }
    if (interesNoEfectivo > 0) {
      for (let k = todas.length - 1; k >= 0; k--) {
        if (todas[k].forma.trim().toLowerCase() !== "efectivo") {
          todas[k].interesLista = interesNoEfectivo;
          break;
        }
      }
    }
    return todas;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (conCuotas.length === 0) {
      setError("Tildá al menos una cuota de algún integrante.");
      return;
    }
    const lineasValidas = lineasPago.filter((l) => (Number(l.monto) || 0) > 0);
    if (lineasValidas.length === 0) {
      setError("Ingresá el monto cobrado en al menos una forma de pago.");
      return;
    }
    if (Math.abs(diferencia) >= 1) {
      setError(
        diferencia > 0
          ? `Faltan ${formatMoney(diferencia)} para completar el total a pagar.`
          : `Sobran ${formatMoney(-diferencia)}: las líneas no pueden superar el total a pagar.`
      );
      return;
    }

    setSaving(true);
    try {
      const loteId = crypto.randomUUID();
      const partes = armarPartes();

      for (const parte of partes) {
        const body = {
          alumno_id: parte.alumnoId,
          fecha,
          monto: parte.monto,
          forma_de_pago: parte.forma,
          interes: parte.interesAtraso + parte.interesLista,
          interes_pct: 0,
          bonificacion: 0,
          nota: construirNota(nota, {
            loteId,
            grupoId: parte.grupoId,
            interesAtraso: parte.interesAtraso,
            interesLista: parte.interesLista,
          }),
        };
        const res = await fetch("/api/pagos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(`${parte.alumnoNombre}: ${data.error || "No se pudo registrar el pago"}`);
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
          const tieneVencidas = i.cuotas.some((c) => c.estado === "vencida");
          const atraso = atrasos.get(i.alumno.alumno_id);
          const sinCuotas = i.cuotas.length === 0;
          return (
            <div
              key={i.alumno.alumno_id}
              className={`flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-2 last:border-0 last:pb-0 ${
                sinCuotas ? "opacity-40" : ""
              }`}
            >
              <div className="min-w-[11rem] flex-1">
                <p className="text-sm font-medium text-neutral-800">{i.alumno.alumno}</p>
                {sinCuotas ? (
                  <p className="text-[11px] text-neutral-400">Sin cuotas tildadas</p>
                ) : (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {i.cuotas.map((c) => (
                      <span
                        key={c.numero}
                        className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                          c.estado === "vencida"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                        title={`Cuota ${c.numero}° — ${c.estado}`}
                      >
                        {c.numero}° {formatMoney(c.monto)}
                        {c.estado === "vencida" ? " · Vencida" : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {tieneVencidas && (
                <label
                  className="flex items-center gap-1.5 text-xs text-neutral-500"
                  title="Aplica el % de atraso de abajo solo a las cuotas vencidas de este integrante"
                >
                  <input
                    type="checkbox"
                    checked={filasRecargo[i.alumno.alumno_id] ?? false}
                    disabled={sinCuotas}
                    onChange={(e) =>
                      setFilasRecargo((prev) => ({ ...prev, [i.alumno.alumno_id]: e.target.checked }))
                    }
                  />
                  Con recargo por atraso
                </label>
              )}
              {!sinCuotas && atraso && atraso.interesAtraso > 0 && (
                <span className="text-xs font-medium text-amber-700">
                  → {formatMoney(atraso.subtotal)}
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

      {/* Recargo por atraso: % compartido, solo afecta a los integrantes tildados "Con recargo
          por atraso", y solo a la parte de SUS cuotas que está vencida. */}
      <div className="rounded-lg bg-white p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={atrasado} onChange={(e) => setAtrasado(e.target.checked)} />
          Pago atrasado — aplicar interés (%) a las cuotas vencidas tildadas arriba
        </label>
        {atrasado && (
          <div className="mt-1 pl-6">
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
      </div>

      <div className="rounded-lg bg-emerald-700 p-3 text-white">
        <p className="text-xs text-emerald-100">Total a pagar (cuotas + atraso)</p>
        <p className="text-xl font-bold">{formatMoney(totalAPagar)}</p>
        {totalInteresAtraso > 0 && (
          <p className="text-xs text-emerald-100">
            (cuotas {formatMoney(totalBase)} + atraso {formatMoney(totalInteresAtraso)})
          </p>
        )}
      </div>

      {/* Formas de pago del TOTAL del lote — se arma después de ver el total, con éste como
          tope fijo. */}
      <div className="space-y-2">
        <label className="block text-xs text-neutral-500">
          Formas de pago (repartí el total de arriba si hace falta)
        </label>
        {lineasPago.map((linea, i) => (
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
            {lineasPago.length > 1 && (
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
            (diferencia > 0 ? ` — faltan ${formatMoney(diferencia)}` : ` — sobran ${formatMoney(-diferencia)}`)}
        </p>
      </div>

      {/* Recargo por NO PAGAR EN EFECTIVO: sobre el total ya dividido en formas de pago, no por
          integrante — se suma abajo del total. */}
      <div className="rounded-lg bg-white p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={noEfectivo}
            onChange={(e) => setNoEfectivo(e.target.checked)}
          />
          No pagó en efectivo — aplicar precio de lista (%) sobre lo cobrado en otras formas
        </label>
        {noEfectivo && (
          <div className="mt-1 pl-6">
            <input
              type="number"
              min={0}
              step="any"
              value={pctNoEfectivo}
              onChange={(e) => setPctNoEfectivo(e.target.value)}
              className="w-28 rounded-md border border-neutral-300 p-2 text-sm"
              placeholder="0"
            />
            {baseNoEfectivo === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Ninguna línea está en una forma distinta de Efectivo — no se va a cobrar nada extra.
              </p>
            )}
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
        <p className="text-xl font-bold">{formatMoney(totalACobrar)}</p>
        {interesNoEfectivo > 0 && (
          <p className="text-xs text-emerald-100">
            (líneas {formatMoney(montoTotalIngresado)} + precio de lista {formatMoney(interesNoEfectivo)})
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

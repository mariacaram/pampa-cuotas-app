"use client";

import { useEffect, useState } from "react";
import { AlumnoBase, AlumnoComputed, Colegio, CuotaPlan } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/format";
import { Card, StatCard } from "./ui";
import { Stagger, StaggerItem } from "./motion/Reveal";
import ColegioCombobox from "./ColegioCombobox";

const intFmt = (n: number) => Math.round(n).toLocaleString("es-AR");
const mesActual = new Date().toLocaleDateString("es-AR", { month: "long" });
const HOY_MES = new Date().toISOString().slice(0, 7);

const ESTADO_CUOTA: Record<string, { label: string; cls: string }> = {
  vencida: { label: "Vencida", cls: "bg-red-100 text-red-700" },
  pendiente: { label: "Pendiente", cls: "bg-neutral-100 text-neutral-600" },
  pagada: { label: "Pagada", cls: "bg-emerald-100 text-emerald-800" },
};

type Modo = "atrasado" | "esteMes" | "todos";

type CobranzaColegio = { organizacion: string; alumnos: number; cuotas: number; monto: number };
type CobranzaAlumno = { alumno: string; cuotas: number; monto: number; vencimiento: string };
type Cobranza = {
  scope: string;
  modo: Modo;
  total: number;
  cuotas: number;
  alumnos: number;
  porColegio: CobranzaColegio[];
  alumnosDetalle: CobranzaAlumno[];
};

const TABS: { modo: Modo; label: string; sub: string }[] = [
  { modo: "atrasado", label: "Atrasado", sub: "cuotas ya vencidas e impagas" },
  { modo: "esteMes", label: `Este mes (${mesActual})`, sub: "vence este mes y está al día" },
  { modo: "todos", label: "Todo lo pendiente", sub: "todo el saldo por cobrar" },
];

export default function PendienteView({ colegios }: { colegios: Colegio[] }) {
  const [modo, setModo] = useState<Modo>("atrasado");
  const [colegio, setColegio] = useState("");
  const [data, setData] = useState<Cobranza | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ modo });
        if (colegio) params.set("organizacion", colegio);
        const res = await fetch(`/api/cobranza?${params.toString()}`);
        const d = await res.json();
        if (cancel) return;
        if (!res.ok) throw new Error(d.error || "Error cargando cobranza");
        setData(d.cobranza);
      } catch (e) {
        if (!cancel) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [modo, colegio]);

  // Búsqueda de un alumno puntual (sin elegir colegio).
  const [aq, setAq] = useState("");
  const [aResultados, setAResultados] = useState<AlumnoBase[]>([]);
  const [showAResults, setShowAResults] = useState(false);
  const [aSel, setASel] = useState<AlumnoComputed | null>(null);

  useEffect(() => {
    if (aq.trim().length < 2) {
      setAResultados([]);
      return;
    }
    let cancel = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/alumnos?q=${encodeURIComponent(aq.trim())}`);
        const d = await res.json();
        if (!cancel) setAResultados(res.ok ? d.alumnos : []);
      } catch {
        if (!cancel) setAResultados([]);
      }
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [aq]);

  async function elegirAlumno(id: string) {
    setAq("");
    setAResultados([]);
    setShowAResults(false);
    try {
      const res = await fetch(`/api/alumno?id=${encodeURIComponent(id)}`);
      const d = await res.json();
      if (res.ok) setASel(d.alumno);
    } catch {
      // ignorar
    }
  }

  // Cuotas del alumno seleccionado que corresponden al filtro activo.
  function cuotasDelModo(al: AlumnoComputed): CuotaPlan[] {
    return al.cuotasPlan.filter((c) => {
      if (c.estado === "pagada") return false;
      if (modo === "atrasado") return c.estado === "vencida";
      if (modo === "esteMes") return c.estado === "pendiente" && c.vencimiento.slice(0, 7) === HOY_MES;
      return true;
    });
  }

  const tabActual = TABS.find((t) => t.modo === modo)!;
  const expQs = `format=xlsx&modo=${modo}${colegio ? `&organizacion=${encodeURIComponent(colegio)}` : ""}`;
  const expQsPdf = `format=pdf&modo=${modo}${colegio ? `&organizacion=${encodeURIComponent(colegio)}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Pendiente de cobro</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Elegí qué querés ver: lo atrasado, lo de este mes, o todo{data ? ` · ${data.scope}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-neutral-500">Filtrar por colegio</label>
            <ColegioCombobox
              colegios={colegios}
              value={colegio}
              onChange={setColegio}
              className="mt-1 w-full sm:w-72"
            />
          </div>
          <a
            href={`/api/proyeccion/export?${expQs}`}
            className="btn btn-primary rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            ⬇ Excel
          </a>
          <a
            href={`/api/proyeccion/export?${expQsPdf}`}
            className="btn rounded-lg border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            ⬇ PDF
          </a>
        </div>
      </div>

      {/* Tabs de filtro */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.modo}
            onClick={() => setModo(t.modo)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
              modo === t.modo
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Buscar un alumno puntual (sin elegir colegio) */}
      <Card className="relative z-40 overflow-visible">
        <label className="block text-xs text-neutral-500">Buscar un alumno (por nombre)</label>
        <div className="relative mt-1">
          <input
            value={aq}
            onChange={(e) => {
              setAq(e.target.value);
              setShowAResults(true);
            }}
            onFocus={() => setShowAResults(true)}
            placeholder="Escribí el nombre del alumno…"
            className="w-full rounded-md border border-neutral-300 p-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          {showAResults && aq.trim().length >= 2 && (
            <div className="thin-scroll absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
              {aResultados.length === 0 && <p className="p-3 text-sm text-neutral-400">Sin resultados.</p>}
              {aResultados.map((a) => (
                <button
                  key={a.alumno_id}
                  onClick={() => elegirAlumno(a.alumno_id)}
                  className="flex w-full items-center justify-between gap-3 border-t border-neutral-100 px-3 py-2 text-left text-sm first:border-t-0 hover:bg-emerald-50/60"
                >
                  <span className="font-medium text-neutral-800">{a.alumno}</span>
                  <span className="text-xs text-neutral-500">{a.organizacion}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Detalle del alumno buscado (cuotas según el filtro activo) */}
      {aSel && (
        <Card>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-base font-bold text-neutral-900">{aSel.alumno}</p>
              <p className="text-xs text-neutral-500">
                {aSel.organizacion} · Saldo total {formatMoney(aSel.saldo)}
              </p>
            </div>
            <button
              onClick={() => setASel(null)}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
            >
              Quitar
            </button>
          </div>
          {(() => {
            const cuotas = cuotasDelModo(aSel);
            const total = cuotas.reduce((s, c) => s + c.monto, 0);
            if (cuotas.length === 0)
              return (
                <p className="text-sm text-neutral-400">
                  Este alumno no tiene cuotas en el filtro <b>{tabActual.label}</b>.
                </p>
              );
            return (
              <div className="thin-scroll overflow-x-auto">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead className="text-left text-xs text-neutral-500">
                    <tr>
                      <th className="p-2">Cuota</th>
                      <th className="p-2">Vencimiento</th>
                      <th className="p-2">Estado</th>
                      <th className="p-2">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotas.map((c) => (
                      <tr key={c.numero} className="border-t border-neutral-100">
                        <td className="p-2 font-medium">{c.numero}°</td>
                        <td className="p-2">{c.vencimiento ? formatDate(c.vencimiento) : "—"}</td>
                        <td className="p-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_CUOTA[c.estado].cls}`}>
                            {ESTADO_CUOTA[c.estado].label}
                          </span>
                        </td>
                        <td className="p-2">{formatMoney(c.monto)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-neutral-200 font-semibold">
                      <td className="p-2" colSpan={3}>Total ({tabActual.label})</td>
                      <td className="p-2 text-emerald-800">{formatMoney(total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
        </Card>
      )}

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading && !data ? (
        <p className="text-sm text-neutral-400">Cargando…</p>
      ) : data ? (
        <>
          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StaggerItem>
              <StatCard
                label={modo === "atrasado" ? "Total atrasado" : modo === "esteMes" ? `A cobrar en ${mesActual}` : "Total pendiente"}
                animateTo={data.total}
                format={formatMoney}
                accent
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Cuotas" animateTo={data.cuotas} format={intFmt} sub={tabActual.sub} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Alumnos" animateTo={data.alumnos} format={intFmt} />
            </StaggerItem>
          </Stagger>

          <p className="text-xs text-neutral-400">
            Vencimientos: la 1ª cuota vence a fin del mes de la orden; la 2ª, 3ª, … el 15 de cada mes.
            {modo === "atrasado" && " Acá aparece solo lo que ya venció y no se pagó."}
            {modo === "esteMes" && " Acá aparece lo que vence este mes y todavía no está vencido."}
          </p>

          {!colegio ? (
            <Card className="p-0">
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
                <p className="text-sm font-semibold text-neutral-800">
                  Colegios ordenados por monto ({data.porColegio.length})
                </p>
                <span className="hidden text-xs text-neutral-400 sm:block">Tocá un colegio para ver los alumnos</span>
              </div>
              <div className="thin-scroll max-h-[32rem] overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
                    <tr>
                      <th className="p-3">Colegio</th>
                      <th className="p-3">Alumnos</th>
                      <th className="p-3">Cuotas</th>
                      <th className="p-3">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.porColegio.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-neutral-400">
                          No hay nada en este filtro.
                        </td>
                      </tr>
                    )}
                    {data.porColegio.map((c) => (
                      <tr
                        key={c.organizacion}
                        onClick={() => setColegio(c.organizacion)}
                        className="cursor-pointer border-t border-neutral-100 hover:bg-emerald-50/50"
                      >
                        <td className="p-3">{c.organizacion}</td>
                        <td className="p-3">{c.alumnos}</td>
                        <td className="p-3">{c.cuotas}</td>
                        <td className="p-3 font-semibold text-emerald-800">{formatMoney(c.monto)}</td>
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
                  Alumnos en {colegio} ({data.alumnosDetalle.length})
                </p>
              </div>
              <div className="thin-scroll max-h-[32rem] overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
                    <tr>
                      <th className="p-3">Alumno</th>
                      <th className="p-3">Cuotas</th>
                      <th className="p-3">Vencimiento</th>
                      <th className="p-3">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.alumnosDetalle.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-neutral-400">
                          No hay alumnos en este filtro.
                        </td>
                      </tr>
                    )}
                    {data.alumnosDetalle.map((a) => (
                      <tr key={a.alumno} className="border-t border-neutral-100">
                        <td className="p-3">{a.alumno}</td>
                        <td className="p-3 text-neutral-600">{a.cuotas}</td>
                        <td className="p-3 text-neutral-600">
                          {a.vencimiento ? formatDate(a.vencimiento) : "—"}
                        </td>
                        <td className="p-3 font-medium">{formatMoney(a.monto)}</td>
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

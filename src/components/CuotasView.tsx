"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlumnoBase, AlumnoComputed, Colegio } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Card, SituacionPill } from "./ui";
import AlumnoDetail from "./AlumnoDetail";
import ColegioCombobox from "./ColegioCombobox";
import AlumnoCombobox from "./AlumnoCombobox";
import NuevaVentaForm from "./NuevaVentaForm";
import PagoGrupalForm from "./PagoGrupalForm";
import LotesPanel from "./LotesPanel";

export default function CuotasView({ colegios }: { colegios: Colegio[] }) {
  const [colegio, setColegio] = useState("");

  const [alumnos, setAlumnos] = useState<AlumnoBase[]>([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [alumnoId, setAlumnoId] = useState("");

  const [alumno, setAlumno] = useState<AlumnoComputed | null>(null);
  const [loadingAlumno, setLoadingAlumno] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Búsqueda global por alumno (sin elegir colegio).
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<AlumnoBase[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Alta de venta nueva.
  const [nuevaVenta, setNuevaVenta] = useState(false);

  // Pago grupal: seleccionar varios alumnos del mismo colegio (ej. una institución que paga
  // junta la cuota de varios chicos) y cargarles el pago a todos de una.
  const [modoGrupal, setModoGrupal] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [mostrarLotes, setMostrarLotes] = useState(false);

  // Cuando venimos de la búsqueda global, queremos seleccionar ESTE alumno aunque
  // el efecto del colegio cargue su lista después.
  const desiredAlumno = useRef<string>("");

  useEffect(() => {
    if (!colegio) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlumnos([]);
      if (!desiredAlumno.current) setAlumnoId("");
      return;
    }
    let cancel = false;
    setLoadingAlumnos(true);
    (async () => {
      try {
        const res = await fetch(`/api/alumnos?organizacion=${encodeURIComponent(colegio)}`);
        const data = await res.json();
        if (cancel) return;
        if (!res.ok) throw new Error(data.error || "Error cargando alumnos");
        setAlumnos(data.alumnos);
        const wanted = desiredAlumno.current;
        if (wanted && data.alumnos.some((a: AlumnoBase) => a.alumno_id === wanted)) {
          setAlumnoId(wanted);
        } else if (!wanted) {
          setAlumnoId(data.alumnos[0]?.alumno_id ?? "");
        }
        desiredAlumno.current = "";
      } catch (e) {
        if (!cancel) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancel) setLoadingAlumnos(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [colegio]);

  const loadAlumno = useCallback(async (id: string) => {
    if (!id) {
      setAlumno(null);
      return;
    }
    setLoadingAlumno(true);
    try {
      const res = await fetch(`/api/alumno?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error cargando alumno");
      setAlumno(data.alumno);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoadingAlumno(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAlumno(alumnoId);
  }, [alumnoId, loadAlumno]);

  // Búsqueda global con debounce.
  useEffect(() => {
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    let cancel = false;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/alumnos?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        if (cancel) return;
        setResultados(res.ok ? data.alumnos : []);
      } catch {
        if (!cancel) setResultados([]);
      } finally {
        if (!cancel) setBuscando(false);
      }
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [q]);

  // Selecciona un alumno (desde la búsqueda o tras crear una venta).
  function seleccionarAlumno(id: string, organizacion: string) {
    desiredAlumno.current = id;
    setQ("");
    setResultados([]);
    setShowResults(false);
    setNuevaVenta(false);
    setColegio(organizacion);
    setAlumnoId(id);
  }

  function toggleModoGrupal() {
    setModoGrupal((v) => !v);
    setSeleccionados(new Set());
  }

  function toggleSeleccionado(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onPagoGrupalRegistrado() {
    setModoGrupal(false);
    setSeleccionados(new Set());
    // Si el alumno abierto en la ficha era parte del lote, refrescamos su saldo.
    if (alumnoId) loadAlumno(alumnoId);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Cuotas y pagos</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Buscá un alumno por nombre, o elegí colegio y alumno para ver su saldo y registrar pagos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMostrarLotes((v) => !v)}
            className="btn rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            {mostrarLotes ? "Ocultar pagos grupales" : "Ver pagos grupales"}
          </button>
          <button
            onClick={toggleModoGrupal}
            disabled={!colegio}
            title={!colegio ? "Elegí primero un colegio" : undefined}
            className="btn rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {modoGrupal ? "Cancelar pago grupal" : "Pago grupal"}
          </button>
          <button
            onClick={() => setNuevaVenta((v) => !v)}
            className="btn btn-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {nuevaVenta ? "Cerrar" : "+ Nueva venta"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {mostrarLotes && <LotesPanel />}

      {nuevaVenta && (
        <NuevaVentaForm
          colegios={colegios}
          onCreada={(id, org) => seleccionarAlumno(id, org)}
          onCancel={() => setNuevaVenta(false)}
        />
      )}

      {modoGrupal && seleccionados.size > 0 && (
        <PagoGrupalForm
          colegio={colegio}
          alumnos={alumnos.filter((a) => seleccionados.has(a.alumno_id))}
          onRegistrado={onPagoGrupalRegistrado}
          onCancel={toggleModoGrupal}
        />
      )}

      {/* Colegio y Alumno — en cualquier orden */}
      <Card className="relative z-40 overflow-visible">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500">Colegio</label>
            <ColegioCombobox
              colegios={colegios}
              value={colegio}
              onChange={setColegio}
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Alumno</label>
            {colegio ? (
              <AlumnoCombobox
                alumnos={alumnos}
                value={alumnoId}
                onChange={setAlumnoId}
                loading={loadingAlumnos}
                className="mt-1 w-full"
              />
            ) : (
              <div className="relative mt-1">
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  placeholder="Buscá por nombre (sin elegir colegio)…"
                  className="w-full rounded-md border border-neutral-300 p-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                {showResults && q.trim().length >= 2 && (
                  <div className="thin-scroll absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
                    {buscando && <p className="p-3 text-sm text-neutral-400">Buscando…</p>}
                    {!buscando && resultados.length === 0 && (
                      <p className="p-3 text-sm text-neutral-400">Sin resultados.</p>
                    )}
                    {resultados.map((a) => (
                      <button
                        key={a.alumno_id}
                        onClick={() => seleccionarAlumno(a.alumno_id, a.organizacion)}
                        className="flex w-full items-center justify-between gap-3 border-t border-neutral-100 px-3 py-2 text-left text-sm first:border-t-0 hover:bg-emerald-50/60"
                      >
                        <span className="font-medium text-neutral-800">{a.alumno}</span>
                        <span className="text-xs text-neutral-500">{a.organizacion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          Empezá por donde quieras: buscá el alumno por nombre, o elegí primero el colegio.
        </p>
      </Card>

      {!modoGrupal && loadingAlumno && <p className="text-sm text-neutral-400">Cargando alumno…</p>}
      {!modoGrupal && !loadingAlumno && alumno && (
        <AlumnoDetail alumno={alumno} onRegistrado={() => loadAlumno(alumnoId)} />
      )}

      {modoGrupal && seleccionados.size === 0 && (
        <p className="text-sm text-neutral-500">
          Tildá abajo a los alumnos que están pagando juntos en este cobro grupal.
        </p>
      )}

      {colegio && !loadingAlumnos && alumnos.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-neutral-100 px-5 py-3">
            <p className="text-sm font-semibold text-neutral-800">
              Alumnos de {colegio} ({alumnos.length})
            </p>
          </div>
          <div className="thin-scroll max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  {modoGrupal && <th className="p-3"></th>}
                  <th className="p-3">Alumno</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Saldo (planilla)</th>
                  <th className="p-3">Situación</th>
                </tr>
              </thead>
              <tbody>
                {alumnos.map((a) => (
                  <tr
                    key={a.alumno_id}
                    onClick={() =>
                      modoGrupal ? toggleSeleccionado(a.alumno_id) : setAlumnoId(a.alumno_id)
                    }
                    className={`cursor-pointer border-t border-neutral-100 hover:bg-emerald-50/50 ${
                      modoGrupal
                        ? seleccionados.has(a.alumno_id)
                          ? "bg-emerald-50"
                          : ""
                        : a.alumno_id === alumnoId
                          ? "bg-emerald-50"
                          : ""
                    }`}
                  >
                    {modoGrupal && (
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={seleccionados.has(a.alumno_id)}
                          onChange={() => toggleSeleccionado(a.alumno_id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    <td className="p-3">{a.alumno}</td>
                    <td className="p-3">{formatMoney(a.total_asignado)}</td>
                    <td className="p-3">{formatMoney(a.saldo_base)}</td>
                    <td className="p-3">
                      <SituacionPill situacion={a.situacion_base} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

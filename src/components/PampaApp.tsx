"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlumnoBase, AlumnoComputed, Colegio } from "@/lib/types";
import { formatMoney, SITUACION_STYLES } from "@/lib/format";
import AlumnoDetail from "./AlumnoDetail";

export default function PampaApp() {
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [source, setSource] = useState<string>("");
  const [loadingColegios, setLoadingColegios] = useState(true);
  const [colegioFiltro, setColegioFiltro] = useState("");
  const [colegio, setColegio] = useState("");

  const [alumnos, setAlumnos] = useState<AlumnoBase[]>([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [alumnoId, setAlumnoId] = useState("");

  const [alumno, setAlumno] = useState<AlumnoComputed | null>(null);
  const [loadingAlumno, setLoadingAlumno] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar colegios al inicio.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/colegios");
        const data = await res.json();
        if (cancel) return;
        if (!res.ok) throw new Error(data.error || "Error cargando colegios");
        setColegios(data.colegios);
        setSource(data.source);
      } catch (e) {
        if (!cancel) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancel) setLoadingColegios(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // Cargar alumnos cuando cambia el colegio.
  useEffect(() => {
    if (!colegio) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlumnos([]);
      setAlumnoId("");
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
        setAlumnoId(data.alumnos[0]?.alumno_id ?? "");
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

  // Cargar detalle cuando cambia el alumno seleccionado.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAlumno(alumnoId);
  }, [alumnoId, loadAlumno]);

  const colegiosFiltrados = useMemo(() => {
    const q = colegioFiltro.trim().toLocaleLowerCase("es");
    if (!q) return colegios;
    return colegios.filter((c) => c.organizacion.toLocaleLowerCase("es").includes(q));
  }, [colegios, colegioFiltro]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Pampa · Control de cuotas</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Elegí un colegio y un alumno para ver su saldo y registrar pagos.
          </p>
          {source && (
            <p className="mt-1 text-xs text-neutral-400">
              Fuente de datos: {source === "supabase" ? "base de datos (Supabase)" : "archivo local (modo prueba)"}
            </p>
          )}
        </div>
        <a
          href="/api/export"
          className="whitespace-nowrap rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          ⬇ Exportar a Excel
        </a>
      </header>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {!loadingColegios && !error && colegios.length === 0 && (
        <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          No hay datos cargados todavía. Falta conectar la base de datos (Supabase) e importar la
          planilla. Seguí los pasos del README para dejarlo funcionando.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-neutral-500">Colegio</label>
          <input
            value={colegioFiltro}
            onChange={(e) => setColegioFiltro(e.target.value)}
            placeholder="Buscar colegio…"
            className="mt-1 mb-2 w-full rounded-md border border-neutral-300 p-2 text-sm"
          />
          <select
            value={colegio}
            onChange={(e) => setColegio(e.target.value)}
            className="w-full rounded-md border border-neutral-300 p-2 text-sm"
            size={1}
          >
            <option value="">
              {loadingColegios ? "Cargando…" : `-- elegí un colegio (${colegios.length}) --`}
            </option>
            {colegiosFiltrados.map((c) => (
              <option key={c.organizacion} value={c.organizacion}>
                {c.organizacion} ({c.cantidadAlumnos})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-neutral-500">Alumno</label>
          <select
            value={alumnoId}
            onChange={(e) => setAlumnoId(e.target.value)}
            disabled={!colegio || loadingAlumnos}
            className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm disabled:bg-neutral-50"
          >
            {!colegio ? (
              <option value="">Primero elegí un colegio</option>
            ) : loadingAlumnos ? (
              <option value="">Cargando alumnos…</option>
            ) : (
              alumnos.map((a) => (
                <option key={a.alumno_id} value={a.alumno_id}>
                  {a.alumno}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {loadingAlumno && <p className="text-sm text-neutral-400">Cargando alumno…</p>}

      {!loadingAlumno && alumno && (
        <AlumnoDetail alumno={alumno} onRegistrado={() => loadAlumno(alumnoId)} />
      )}

      {!loadingAlumno && !alumno && colegio && alumnos.length > 0 && (
        <p className="text-sm text-neutral-400">Elegí un alumno para ver el detalle.</p>
      )}

      {colegio && !loadingAlumnos && alumnos.length > 0 && (
        <div className="mt-8">
          <p className="mb-2 text-sm font-medium text-neutral-800">
            Alumnos de {colegio} ({alumnos.length})
          </p>
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-xs text-neutral-500">
                  <th className="p-2">Alumno</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Saldo (planilla)</th>
                  <th className="p-2">Situación</th>
                </tr>
              </thead>
              <tbody>
                {alumnos.map((a) => (
                  <tr
                    key={a.alumno_id}
                    onClick={() => setAlumnoId(a.alumno_id)}
                    className={`cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 ${
                      a.alumno_id === alumnoId ? "bg-neutral-50" : ""
                    }`}
                  >
                    <td className="p-2">{a.alumno}</td>
                    <td className="p-2">{formatMoney(a.total_asignado)}</td>
                    <td className="p-2">{formatMoney(a.saldo_base)}</td>
                    <td className="p-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          SITUACION_STYLES[a.situacion_base] ?? "bg-neutral-200 text-neutral-700"
                        }`}
                      >
                        {a.situacion_base}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

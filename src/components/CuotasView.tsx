"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlumnoBase, AlumnoComputed, Colegio } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Card, SituacionPill } from "./ui";
import AlumnoDetail from "./AlumnoDetail";

export default function CuotasView({ colegios }: { colegios: Colegio[] }) {
  const [colegioFiltro, setColegioFiltro] = useState("");
  const [colegio, setColegio] = useState("");

  const [alumnos, setAlumnos] = useState<AlumnoBase[]>([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [alumnoId, setAlumnoId] = useState("");

  const [alumno, setAlumno] = useState<AlumnoComputed | null>(null);
  const [loadingAlumno, setLoadingAlumno] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Cuotas y pagos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Elegí un colegio y un alumno para ver su saldo y registrar pagos.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500">Colegio</label>
            <input
              value={colegioFiltro}
              onChange={(e) => setColegioFiltro(e.target.value)}
              placeholder="Buscar colegio…"
              className="mt-1 mb-2 w-full rounded-lg border border-neutral-300 p-2 text-sm"
            />
            <select
              value={colegio}
              onChange={(e) => setColegio(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 p-2 text-sm"
            >
              <option value="">-- elegí un colegio ({colegios.length}) --</option>
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
              className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm disabled:bg-neutral-50"
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
      </Card>

      {loadingAlumno && <p className="text-sm text-neutral-400">Cargando alumno…</p>}
      {!loadingAlumno && alumno && (
        <AlumnoDetail alumno={alumno} onRegistrado={() => loadAlumno(alumnoId)} />
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
                    onClick={() => setAlumnoId(a.alumno_id)}
                    className={`cursor-pointer border-t border-neutral-100 hover:bg-emerald-50/50 ${
                      a.alumno_id === alumnoId ? "bg-emerald-50" : ""
                    }`}
                  >
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

"use client";

import { useMemo, useState } from "react";
import { Alumno, Dataset } from "@/lib/types";
import { calcularAlumno } from "@/lib/calc";
import { standardizeName } from "@/lib/nameUtils";

type Props = {
  dataset: Dataset;
  onUpdateAlumno: (id: string, patch: Partial<Alumno>) => void;
  onNormalizeAll: () => void;
  onReset: () => void;
};

const ESTADO_STYLES: Record<string, string> = {
  Pagado: "bg-green-100 text-green-800",
  Atrasado: "bg-red-100 text-red-800",
  Pendiente: "bg-amber-100 text-amber-800",
};

export default function Dashboard({ dataset, onUpdateAlumno, onNormalizeAll, onReset }: Props) {
  const colegios = useMemo(
    () => Array.from(new Set(dataset.alumnos.map((a) => a.colegio))).sort(),
    [dataset]
  );

  const [selectedColegio, setSelectedColegio] = useState(colegios[0] ?? "");

  const alumnosDelColegio = useMemo(
    () => dataset.alumnos.filter((a) => a.colegio === selectedColegio),
    [dataset, selectedColegio]
  );

  const [selectedAlumnoId, setSelectedAlumnoId] = useState(alumnosDelColegio[0]?.id ?? "");

  const alumno =
    dataset.alumnos.find((a) => a.id === selectedAlumnoId) ?? alumnosDelColegio[0];

  function handleColegioChange(colegio: string) {
    setSelectedColegio(colegio);
    const first = dataset.alumnos.find((a) => a.colegio === colegio);
    setSelectedAlumnoId(first?.id ?? "");
  }

  if (!alumno) {
    return (
      <div className="text-center text-neutral-500">
        No hay alumnos cargados.
        <div className="mt-3">
          <button onClick={onReset} className="text-sm text-blue-600 underline">
            Volver a cargar datos
          </button>
        </div>
      </div>
    );
  }

  const calc = calcularAlumno(alumno);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-neutral-500">Colegio</label>
            <select
              value={selectedColegio}
              onChange={(e) => handleColegioChange(e.target.value)}
              className="mt-1 min-w-[220px] rounded-md border border-neutral-300 p-2 text-sm"
            >
              {colegios.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Alumno</label>
            <select
              value={selectedAlumnoId}
              onChange={(e) => setSelectedAlumnoId(e.target.value)}
              className="mt-1 min-w-[220px] rounded-md border border-neutral-300 p-2 text-sm"
            >
              {alumnosDelColegio.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombreEstandarizado}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onNormalizeAll} className="text-sm text-blue-600 underline underline-offset-2">
            Normalizar todos los nombres
          </button>
          <button onClick={onReset} className="text-sm text-neutral-500 underline underline-offset-2">
            Cargar otro archivo
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-neutral-500">Nombre estandarizado</label>
            <div className="mt-1 flex gap-2">
              <input
                value={alumno.nombreEstandarizado}
                onChange={(e) => onUpdateAlumno(alumno.id, { nombreEstandarizado: e.target.value })}
                className="w-full rounded-md border border-neutral-300 p-2 text-sm"
              />
              <button
                onClick={() =>
                  onUpdateAlumno(alumno.id, {
                    nombreEstandarizado: standardizeName(alumno.nombreOriginal),
                  })
                }
                className="whitespace-nowrap rounded-md border border-neutral-300 px-3 text-sm"
              >
                Normalizar
              </button>
            </div>
            <p className="mt-1 text-xs text-neutral-400">Original: {alumno.nombreOriginal}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${ESTADO_STYLES[calc.estado]}`}>
            {calc.estado}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Precio total" value={formatMoney(alumno.precioTotal)} />
          <Stat label="Pagado" value={formatMoney(alumno.pagado)} />
          <Stat label="Saldo" value={formatMoney(calc.saldo)} highlight />
          <Stat label="Monto por cuota" value={formatMoney(calc.montoCuota)} />
          <div>
            <label className="block text-xs text-neutral-500">Cuotas pactadas</label>
            <input
              type="number"
              min={1}
              value={alumno.cuotasPactadas}
              onChange={(e) =>
                onUpdateAlumno(alumno.id, { cuotasPactadas: Number(e.target.value) || 1 })
              }
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
            />
          </div>
          <Stat label="Cuotas pagadas" value={String(calc.cuotasPagadas)} />
          <Stat label="Cuotas pendientes" value={String(calc.cuotasPendientes)} highlight />
        </div>

        <div className="mt-5 border-t border-neutral-200 pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={alumno.atrasado}
              onChange={(e) => onUpdateAlumno(alumno.id, { atrasado: e.target.checked })}
            />
            Pago atrasado — aplicar interés
          </label>

          {alumno.atrasado && (
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs text-neutral-500">Monto de interés ($)</label>
              <input
                type="number"
                min={0}
                value={alumno.interes}
                onChange={(e) => onUpdateAlumno(alumno.id, { interes: Number(e.target.value) || 0 })}
                className="w-32 rounded-md border border-neutral-300 p-2 text-sm"
              />
            </div>
          )}

          <div className="mt-4 rounded-lg bg-neutral-900 p-4 text-white">
            <p className="text-xs text-neutral-300">Total a pagar</p>
            <p className="text-2xl font-semibold">{formatMoney(calc.totalAPagar)}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="p-2">Alumno</th>
              <th className="p-2">Saldo</th>
              <th className="p-2">Cuotas pendientes</th>
              <th className="p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {alumnosDelColegio.map((a) => {
              const c = calcularAlumno(a);
              return (
                <tr
                  key={a.id}
                  onClick={() => setSelectedAlumnoId(a.id)}
                  className={`cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 ${
                    a.id === alumno.id ? "bg-neutral-50" : ""
                  }`}
                >
                  <td className="p-2">{a.nombreEstandarizado}</td>
                  <td className="p-2">{formatMoney(c.saldo)}</td>
                  <td className="p-2">{c.cuotasPendientes}</td>
                  <td className="p-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_STYLES[c.estado]}`}>
                      {c.estado}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-sm ${highlight ? "font-semibold" : ""}`}>{value}</p>
    </div>
  );
}

function formatMoney(n: number): string {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

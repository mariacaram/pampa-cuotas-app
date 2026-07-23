"use client";

import { useEffect, useState } from "react";
import { Dataset, Alumno } from "@/lib/types";
import { loadDataset, saveDataset, clearDataset } from "@/lib/storage";
import { standardizeName } from "@/lib/nameUtils";
import UploadPanel from "./UploadPanel";
import Dashboard from "./Dashboard";

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Reads localStorage on mount; only exists client-side so this can't run during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDataset(loadDataset());
    setReady(true);
  }, []);

  function handleDatasetReady(d: Dataset) {
    setDataset(d);
    saveDataset(d);
  }

  function handleUpdateAlumno(id: string, patch: Partial<Alumno>) {
    setDataset((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        alumnos: prev.alumnos.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      };
      saveDataset(next);
      return next;
    });
  }

  function handleNormalizeAll() {
    setDataset((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        alumnos: prev.alumnos.map((a) => ({
          ...a,
          nombreEstandarizado: standardizeName(a.nombreOriginal),
        })),
      };
      saveDataset(next);
      return next;
    });
  }

  function handleReset() {
    clearDataset();
    setDataset(null);
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Pampa · Control de cuotas</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cargá el Excel de un colegio, seguí el pago de cada alumno y aplicá interés por atraso.
        </p>
      </header>

      {dataset ? (
        <Dashboard
          dataset={dataset}
          onUpdateAlumno={handleUpdateAlumno}
          onNormalizeAll={handleNormalizeAll}
          onReset={handleReset}
        />
      ) : (
        <UploadPanel onDatasetReady={handleDatasetReady} />
      )}
    </main>
  );
}

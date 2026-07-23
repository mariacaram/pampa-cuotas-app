"use client";

import { useEffect, useState } from "react";
import { Colegio } from "@/lib/types";
import Sidebar, { View } from "./Sidebar";
import TableroView from "./TableroView";
import CuotasView from "./CuotasView";

export default function AppRoot() {
  const [view, setView] = useState<View>("tablero");
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const sinDatos = !loading && !error && colegios.length === 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar view={view} onChange={setView} />
      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {sinDatos && (
            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              No hay datos cargados. Falta conectar la base de datos (Supabase) e importar la
              planilla — ver el README.
            </div>
          )}

          {loading ? (
            <p className="text-sm text-neutral-400">Cargando…</p>
          ) : view === "tablero" ? (
            <TableroView colegios={colegios} />
          ) : (
            <CuotasView colegios={colegios} />
          )}

          {source && (
            <p className="mt-8 text-center text-xs text-neutral-400">
              Fuente de datos: {source === "supabase" ? "base de datos (Supabase)" : "archivo local (modo prueba)"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

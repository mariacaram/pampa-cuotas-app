"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Colegio } from "@/lib/types";
import Sidebar, { View, VIEW_ORDER } from "./Sidebar";
import TableroView from "./TableroView";
import PendienteView from "./PendienteView";
import CajaView from "./CajaView";
import ProductosView from "./ProductosView";
import CuotasView from "./CuotasView";

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

export default function AppRoot() {
  const [view, setView] = useState<View>("tablero");
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();

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

  // Atajos de teclado: 1-5 cambian de sección, "/" enfoca el primer buscador.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/" && !isTyping(e.target)) {
        const input = document.querySelector<HTMLInputElement>('input[type="text"], input:not([type])');
        if (input) {
          e.preventDefault();
          input.focus();
        }
        return;
      }
      if (isTyping(e.target)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= VIEW_ORDER.length) {
        e.preventDefault();
        setView(VIEW_ORDER[n - 1]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
            <LoadingSkeleton />
          ) : (
            <motion.div
              key={view}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {view === "tablero" ? (
                <TableroView colegios={colegios} />
              ) : view === "pendiente" ? (
                <PendienteView colegios={colegios} />
              ) : view === "caja" ? (
                <CajaView />
              ) : view === "productos" ? (
                <ProductosView colegios={colegios} />
              ) : (
                <CuotasView colegios={colegios} />
              )}
            </motion.div>
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

function LoadingSkeleton() {
  return (
    <div className="animate-fade space-y-6">
      <div className="h-8 w-56 rounded-lg bg-neutral-200/70" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-neutral-200/60" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-neutral-200/50" />
    </div>
  );
}

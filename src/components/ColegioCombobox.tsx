"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Colegio } from "@/lib/types";

// Buscador de colegio con autocompletado: se escribe y la lista se filtra en vivo.
export default function ColegioCombobox({
  colegios,
  value,
  onChange,
  className = "",
}: {
  colegios: Colegio[];
  value: string; // organizacion seleccionada ("" = todos)
  onChange: (org: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const opciones = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    const base = q
      ? colegios.filter((c) => c.organizacion.toLocaleLowerCase("es").includes(q))
      : colegios;
    return [
      { organizacion: "", cantidadAlumnos: colegios.length, todos: true as const },
      ...base.slice(0, 80),
    ];
  }, [colegios, query]);

  function seleccionar(org: string) {
    onChange(org);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, opciones.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const op = opciones[highlight];
      if (op) seleccionar(op.organizacion);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  // Mantener la opción resaltada visible al navegar con teclado.
  useEffect(() => {
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const displayValue = open ? query : value;

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          placeholder={value ? value : "Todos los colegios"}
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setHighlight(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-neutral-300 bg-white p-2 pr-14 text-sm transition-shadow"
        />
        {value && !open && (
          <button
            type="button"
            aria-label="Quitar filtro"
            onClick={() => seleccionar("")}
            className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:text-neutral-700"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <svg
          viewBox="0 0 20 20"
          className={`pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M6 8l4 4 4-4" />
        </svg>
      </div>

      {open && (
        <ul
          ref={listRef}
          className="thin-scroll absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {opciones.map((op, i) => {
            const selected = op.organizacion === value;
            const isHi = i === highlight;
            return (
              <li key={op.organizacion || "__todos"}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => seleccionar(op.organizacion)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                    isHi ? "bg-emerald-50" : ""
                  } ${selected ? "font-semibold text-emerald-800" : "text-neutral-700"}`}
                >
                  <span className="truncate">
                    {"todos" in op ? "Todos los colegios" : op.organizacion}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">{op.cantidadAlumnos}</span>
                </button>
              </li>
            );
          })}
          {opciones.length === 1 && (
            <li className="px-3 py-2 text-sm text-neutral-400">Sin coincidencias</li>
          )}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlumnoBase } from "@/lib/types";

// Buscador de alumno con autocompletado: se escribe el nombre y la lista se filtra en vivo.
export default function AlumnoCombobox({
  alumnos,
  value,
  onChange,
  disabled = false,
  loading = false,
  className = "",
}: {
  alumnos: AlumnoBase[];
  value: string; // alumno_id seleccionado
  onChange: (alumnoId: string) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const seleccionadoNombre = useMemo(
    () => alumnos.find((a) => a.alumno_id === value)?.alumno ?? "",
    [alumnos, value]
  );

  const opciones = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    const base = q
      ? alumnos.filter((a) => a.alumno.toLocaleLowerCase("es").includes(q))
      : alumnos;
    return base.slice(0, 80);
  }, [alumnos, query]);

  function seleccionar(id: string) {
    onChange(id);
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
      if (op) seleccionar(op.alumno_id);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  useEffect(() => {
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const placeholder = disabled
    ? "Primero elegí un colegio"
    : loading
      ? "Cargando alumnos…"
      : seleccionadoNombre || "Buscar alumno…";

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled || loading}
          value={open ? query : seleccionadoNombre}
          placeholder={placeholder}
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
          className="w-full rounded-lg border border-neutral-300 bg-white p-2 pr-8 text-sm transition-shadow disabled:bg-neutral-50 disabled:text-neutral-400"
        />
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

      {open && !disabled && !loading && (
        <ul
          ref={listRef}
          className="thin-scroll absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {opciones.map((a, i) => {
            const selected = a.alumno_id === value;
            const isHi = i === highlight;
            return (
              <li key={a.alumno_id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => seleccionar(a.alumno_id)}
                  className={`w-full truncate px-3 py-2 text-left text-sm ${
                    isHi ? "bg-emerald-50" : ""
                  } ${selected ? "font-semibold text-emerald-800" : "text-neutral-700"}`}
                >
                  {a.alumno}
                </button>
              </li>
            );
          })}
          {opciones.length === 0 && (
            <li className="px-3 py-2 text-sm text-neutral-400">Sin coincidencias</li>
          )}
        </ul>
      )}
    </div>
  );
}

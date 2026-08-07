"use client";

import { useState } from "react";
import { AlumnoComputed } from "@/lib/types";
import { formatMoney } from "@/lib/format";

type Props = {
  alumno: AlumnoComputed;
  onGuardado: () => void;
  onCancel: () => void;
};

// Carga a mano el importe de CADA cuota (como la tabla "Cuotas: Opción en N cuotas / Importes"
// del sistema origen) — para pedidos con precio propio que no siguen el reparto automático
// (ej. un integrante que se suma después con un precio distinto al resto del colegio).
// Reemplaza total_asignado y plan_cuotas del alumno para que queden consistentes.
export default function EditarCuotasForm({ alumno, onGuardado, onCancel }: Props) {
  const [montos, setMontos] = useState<string[]>(() =>
    alumno.cuotasPlan.length > 0
      ? alumno.cuotasPlan.map((c) => String(c.monto))
      : [String(alumno.total_asignado || "")]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = montos.reduce((acc, m) => acc + (Number(m) || 0), 0);

  function actualizar(i: number, valor: string) {
    setMontos((prev) => prev.map((m, idx) => (idx === i ? valor : m)));
  }

  function agregarCuota() {
    setMontos((prev) => [...prev, ""]);
  }

  function quitarCuota(i: number) {
    setMontos((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const numeros = montos.map((m) => Number(m) || 0);
    if (numeros.some((n) => n <= 0)) {
      setError("Todas las cuotas deben tener un importe mayor a 0.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/cuotas-manuales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumno_id: alumno.alumno_id, montos: numeros }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo guardar");
      onGuardado();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
    }
  }

  async function volverAutomatico() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cuotas-manuales", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumno_id: alumno.alumno_id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo revertir");
      onGuardado();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={guardar}
      className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-neutral-800">
            Cargar importes de cuota a mano — {alumno.alumno}
          </p>
          <p className="text-xs text-neutral-500">
            Un importe por cuota, como en el sistema viejo. Reemplaza el total y el plan de
            cuotas de este alumno por lo que cargues acá.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-500 hover:bg-white"
        >
          Cancelar
        </button>
      </div>

      <div className="space-y-2 rounded-lg bg-white p-3">
        {montos.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-neutral-500">Pago {i + 1}:</span>
            <input
              type="number"
              min={0}
              step="any"
              value={m}
              onChange={(e) => actualizar(i, e.target.value)}
              className="w-36 rounded-md border border-neutral-300 p-2 text-sm"
              placeholder="0"
            />
            {montos.length > 1 && (
              <button
                type="button"
                onClick={() => quitarCuota(i)}
                className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50"
                title="Quitar esta cuota"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={agregarCuota}
          className="text-xs font-semibold text-indigo-700 hover:text-indigo-800"
        >
          + Agregar cuota
        </button>
      </div>

      <p className="text-sm text-neutral-700">
        Precio total: <b>{formatMoney(total)}</b> en {montos.length} cuota{montos.length !== 1 ? "s" : ""}.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Guardar importes"}
        </button>
        {alumno.cuotasManualActivas && (
          <button
            type="button"
            onClick={volverAutomatico}
            disabled={saving}
            className="rounded-md border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-white disabled:opacity-40"
          >
            Volver al reparto automático
          </button>
        )}
      </div>
    </form>
  );
}

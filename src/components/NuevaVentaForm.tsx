"use client";

import { useState } from "react";
import { Colegio } from "@/lib/types";
import { FORMAS_DE_PAGO, formatMoney } from "@/lib/format";
import { Card } from "./ui";

type Props = {
  colegios: Colegio[];
  onCreada: (alumnoId: string, organizacion: string) => void;
  onCancel: () => void;
};

export default function NuevaVentaForm({ colegios, onCreada, onCancel }: Props) {
  const [alumno, setAlumno] = useState("");
  const [organizacion, setOrganizacion] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [total, setTotal] = useState("");
  const [plan, setPlan] = useState("1");
  const [formaDePago, setFormaDePago] = useState(FORMAS_DE_PAGO[0]);
  const [fechaOrden, setFechaOrden] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalNum = Number(total) || 0;
  const planNum = Math.max(1, Math.round(Number(plan) || 1));
  const cuotaAprox = planNum > 0 ? Math.round(totalNum / planNum) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!alumno.trim()) return setError("Ingresá el nombre del alumno.");
    if (!organizacion.trim()) return setError("Ingresá el colegio.");
    if (!(totalNum > 0)) return setError("El total debe ser mayor a 0.");
    setSaving(true);
    try {
      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumno,
          organizacion,
          nombre_cliente: nombreCliente,
          total_asignado: totalNum,
          plan_cuotas: planNum,
          forma_de_pago: formaDePago,
          fecha_orden: fechaOrden,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo crear la venta");
      onCreada(d.alumno.alumno_id, d.alumno.organizacion);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-800">Nueva venta</p>
          <button type="button" onClick={onCancel} className="text-xs text-neutral-500 hover:text-neutral-800">
            Cancelar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500">Alumno *</label>
            <input
              value={alumno}
              onChange={(e) => setAlumno(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
              placeholder="Nombre y apellido"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Colegio * (elegí uno o escribí uno nuevo)</label>
            <input
              list="colegios-datalist"
              value={organizacion}
              onChange={(e) => setOrganizacion(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
              placeholder="Colegio"
            />
            <datalist id="colegios-datalist">
              {colegios.map((c) => (
                <option key={c.organizacion} value={c.organizacion} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Quién paga (opcional)</label>
            <input
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
              placeholder="Nombre del responsable"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Fecha de la venta</label>
            <input
              type="date"
              value={fechaOrden}
              onChange={(e) => setFechaOrden(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Total ($) *</label>
            <input
              type="number"
              min={0}
              step="any"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Plan de cuotas</label>
            <input
              type="number"
              min={1}
              step="1"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Forma de pago</label>
            <select
              value={formaDePago}
              onChange={(e) => setFormaDePago(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
            >
              {FORMAS_DE_PAGO.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {totalNum > 0 && (
          <p className="text-xs text-neutral-500">
            {planNum} cuota{planNum > 1 ? "s" : ""} de aprox.{" "}
            <span className="font-semibold text-neutral-800">{formatMoney(cuotaAprox)}</span>. La 1ª cuota
            vence a fin de este mes y las siguientes el día 15.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Crear venta"}
        </button>
      </form>
    </Card>
  );
}

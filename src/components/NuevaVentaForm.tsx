"use client";

import { useEffect, useState } from "react";
import { Colegio } from "@/lib/types";
import { FORMAS_DE_PAGO, formatMoney } from "@/lib/format";
import { Card } from "./ui";

type Props = {
  colegios: Colegio[];
  onCreada: (alumnoId: string, organizacion: string) => void;
  onCancel: () => void;
};

type Institucion = {
  nombre: string;
  tipo: "colegio" | "club" | "empresa";
  referente_nombre?: string;
  referente_apellido?: string;
};

const TIPOS = [
  { v: "colegio", l: "Colegio" },
  { v: "club", l: "Club" },
  { v: "empresa", l: "Empresa" },
] as const;

export default function NuevaVentaForm({ colegios, onCreada, onCancel }: Props) {
  const [paso, setPaso] = useState<"institucion" | "alumno">("institucion");
  const [institucion, setInstitucion] = useState("");

  // Paso 1 — institución
  const [modoInst, setModoInst] = useState<"elegir" | "crear">("elegir");
  const [instituciones, setInstituciones] = useState<Institucion[]>([]);
  const [existente, setExistente] = useState("");
  const [tipo, setTipo] = useState<"colegio" | "club" | "empresa">("colegio");
  const [nombreInst, setNombreInst] = useState("");
  const [refNombre, setRefNombre] = useState("");
  const [refApellido, setRefApellido] = useState("");
  const [contacto, setContacto] = useState("");

  // Paso 2 — alumno / particular
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [pagadores, setPagadores] = useState("");
  const [total, setTotal] = useState("");
  const [plan, setPlan] = useState("1");
  const [sena, setSena] = useState("");
  const [formaDePago, setFormaDePago] = useState(FORMAS_DE_PAGO[0]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [prods, setProds] = useState([
    { producto: "", talle: "" },
    { producto: "", talle: "" },
    { producto: "", talle: "" },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<{ nombre: string; id: string } | null>(null);

  useEffect(() => {
    fetch("/api/instituciones")
      .then((r) => r.json())
      .then((d) => setInstituciones(d.instituciones || []))
      .catch(() => {});
  }, []);

  // Nombres de instituciones existentes: colegios (de la base) + instituciones guardadas.
  const nombresExistentes = [
    ...new Set([...colegios.map((c) => c.organizacion), ...instituciones.map((i) => i.nombre)]),
  ].sort((a, b) => a.localeCompare(b, "es"));

  function usarExistente(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!existente.trim()) return setError("Elegí una institución.");
    setInstitucion(existente.trim());
    setPaso("alumno");
  }

  async function crearInstitucion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombreInst.trim()) return setError("Ingresá el nombre de la institución.");
    if (!refNombre.trim() || !refApellido.trim())
      return setError("Ingresá nombre y apellido del referente.");
    setSaving(true);
    try {
      const res = await fetch("/api/instituciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombreInst,
          tipo,
          referente_nombre: refNombre,
          referente_apellido: refApellido,
          contacto,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo crear la institución");
      setInstitucion(d.institucion.nombre);
      setPaso("alumno");
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
    }
  }

  function resetAlumno() {
    setNombre("");
    setApellido("");
    setPagadores("");
    setTotal("");
    setPlan("1");
    setSena("");
    setProds([
      { producto: "", talle: "" },
      { producto: "", talle: "" },
      { producto: "", talle: "" },
    ]);
  }

  async function crearAlumno(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nombreCompleto = `${nombre.trim()} ${apellido.trim()}`.trim();
    const totalNum = Number(total) || 0;
    if (!nombreCompleto) return setError("Ingresá nombre y apellido.");
    if (!(totalNum > 0)) return setError("El total debe ser mayor a 0.");
    setSaving(true);
    try {
      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumno: nombreCompleto,
          organizacion: institucion,
          nombre_cliente: pagadores,
          total_asignado: totalNum,
          plan_cuotas: Math.max(1, Math.round(Number(plan) || 1)),
          sena: Number(sena) || 0,
          forma_de_pago: formaDePago,
          fecha_orden: fecha,
          producto1: prods[0].producto,
          talle1: prods[0].talle,
          producto2: prods[1].producto,
          talle2: prods[1].talle,
          producto3: prods[2].producto,
          talle3: prods[2].talle,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo cargar la venta");
      setUltimo({ nombre: nombreCompleto, id: d.alumno.alumno_id });
      resetAlumno();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
    }
  }

  const totalNum = Number(total) || 0;
  const planNum = Math.max(1, Math.round(Number(plan) || 1));
  const senaNum = Number(sena) || 0;
  const restoAprox = planNum >= 2 ? Math.round((totalNum - senaNum) / (planNum - 1)) : totalNum;

  return (
    <Card>
      {/* Encabezado / stepper */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paso === "institucion" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800"}`}>
            1. Institución
          </span>
          <span className="text-neutral-300">›</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paso === "alumno" ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-500"}`}>
            2. Alumno / particular
          </span>
        </div>
        <button type="button" onClick={onCancel} className="text-xs text-neutral-500 hover:text-neutral-800">
          Cerrar
        </button>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* ---------- PASO 1: INSTITUCIÓN ---------- */}
      {paso === "institucion" && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">
            Primero el cliente general: colegio, club o empresa.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModoInst("elegir")}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${modoInst === "elegir" ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-300 bg-white text-neutral-700"}`}
            >
              Elegir existente
            </button>
            <button
              type="button"
              onClick={() => setModoInst("crear")}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${modoInst === "crear" ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-300 bg-white text-neutral-700"}`}
            >
              Crear nueva
            </button>
          </div>

          {modoInst === "elegir" ? (
            <form onSubmit={usarExistente} className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-500">Institución</label>
                <input
                  list="inst-datalist"
                  value={existente}
                  onChange={(e) => setExistente(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
                  placeholder="Buscá o elegí…"
                />
                <datalist id="inst-datalist">
                  {nombresExistentes.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <button type="submit" className="btn btn-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Continuar →
              </button>
            </form>
          ) : (
            <form onSubmit={crearInstitucion} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-neutral-500">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as "colegio" | "club" | "empresa")}
                  className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
                >
                  {TIPOS.map((t) => (
                    <option key={t.v} value={t.v}>{t.l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500">Nombre de la institución *</label>
                <input value={nombreInst} onChange={(e) => setNombreInst(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm" placeholder="Ej.: Colegio San José" />
              </div>
              <div>
                <label className="block text-xs text-neutral-500">Referente — Nombre *</label>
                <input value={refNombre} onChange={(e) => setRefNombre(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-neutral-500">Referente — Apellido *</label>
                <input value={refApellido} onChange={(e) => setRefApellido(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-neutral-500">Contacto del referente (teléfono / email)</label>
                <input value={contacto} onChange={(e) => setContacto(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm" placeholder="Ej.: 11 5555-5555 · mail@ejemplo.com" />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={saving} className="btn btn-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
                  {saving ? "Guardando…" : "Crear y continuar →"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ---------- PASO 2: ALUMNO / PARTICULAR ---------- */}
      {paso === "alumno" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 p-3">
            <p className="text-sm text-emerald-900">
              Institución: <span className="font-semibold">{institucion}</span>
            </p>
            <button
              type="button"
              onClick={() => { setPaso("institucion"); setUltimo(null); }}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Cambiar institución
            </button>
          </div>

          {ultimo && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-100/70 p-3 text-sm">
              <span className="text-emerald-900">✓ Cargado: <b>{ultimo.nombre}</b>. Podés cargar otro abajo.</span>
              <button
                type="button"
                onClick={() => onCreada(ultimo.id, institucion)}
                className="rounded-md border border-emerald-600 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Ver ficha
              </button>
            </div>
          )}

          <form onSubmit={crearAlumno} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-neutral-500">Nombre *</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Apellido *</label>
              <input value={apellido} onChange={(e) => setApellido(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-500">Posibles pagadores</label>
              <input value={pagadores} onChange={(e) => setPagadores(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm" placeholder="Ej.: Mamá (Ana Pérez), Papá (Juan Pérez)" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Total ($) *</label>
              <input type="number" min={0} step="any" value={total} onChange={(e) => setTotal(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Plan de cuotas</label>
              <input type="number" min={1} step="1" value={plan} onChange={(e) => setPlan(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm" />
            </div>
            {planNum >= 2 && (
              <div>
                <label className="block text-xs text-neutral-500">Seña — 1ª cuota, ya cobrada ($)</label>
                <input type="number" min={0} step="any" value={sena} onChange={(e) => setSena(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm" placeholder="Ej.: 10000 (dejalo vacío si no hubo seña)" />
              </div>
            )}
            <div>
              <label className="block text-xs text-neutral-500">Forma de pago</label>
              <select value={formaDePago} onChange={(e) => setFormaDePago(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm">
                {FORMAS_DE_PAGO.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Fecha de la venta</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm" />
            </div>

            {/* Productos */}
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-500">Productos (opcional)</label>
              <div className="mt-1 space-y-2">
                {prods.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={p.producto}
                      onChange={(e) => setProds((arr) => arr.map((x, j) => (j === i ? { ...x, producto: e.target.value } : x)))}
                      className="flex-1 rounded-md border border-neutral-300 p-2 text-sm"
                      placeholder={`Producto ${i + 1} (ej.: BUZO)`}
                    />
                    <input
                      value={p.talle}
                      onChange={(e) => setProds((arr) => arr.map((x, j) => (j === i ? { ...x, talle: e.target.value } : x)))}
                      className="w-24 rounded-md border border-neutral-300 p-2 text-sm"
                      placeholder="Talle"
                    />
                  </div>
                ))}
              </div>
            </div>

            {totalNum > 0 && (
              <p className="text-xs text-neutral-500 sm:col-span-2">
                {planNum >= 2 ? (
                  <>
                    Seña: <b className="text-neutral-800">{formatMoney(senaNum)}</b> · {planNum - 1} cuota
                    {planNum - 1 > 1 ? "s" : ""} de aprox.{" "}
                    <b className="text-neutral-800">{formatMoney(restoAprox)}</b> · Total {formatMoney(totalNum)}.
                  </>
                ) : (
                  <>Pago único: <b className="text-neutral-800">{formatMoney(totalNum)}</b>.</>
                )}{" "}
                La 1ª vence a fin de mes, las siguientes el día 15.
              </p>
            )}

            <div className="sm:col-span-2">
              <button type="submit" disabled={saving} className="btn btn-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
                {saving ? "Guardando…" : "Cargar alumno"}
              </button>
            </div>
          </form>
        </div>
      )}
    </Card>
  );
}

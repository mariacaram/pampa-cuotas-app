"use client";

import { useState } from "react";
import { AlumnoComputed } from "@/lib/types";
import { formatMoney, formatDate, parseNota } from "@/lib/format";
import { Card, SituacionPill } from "./ui";
import PagoForm from "./PagoForm";
import EditarCuotasForm from "./EditarCuotasForm";

type Props = {
  alumno: AlumnoComputed;
  onRegistrado: () => void;
};

const ESTADO_CUOTA: Record<string, { label: string; cls: string }> = {
  pagada: { label: "Pagada", cls: "bg-emerald-100 text-emerald-800" },
  vencida: { label: "Vencida", cls: "bg-red-100 text-red-700" },
  pendiente: { label: "Pendiente", cls: "bg-neutral-100 text-neutral-600" },
};

export default function AlumnoDetail({ alumno, onRegistrado }: Props) {
  const [anulandoId, setAnulandoId] = useState<number | string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editandoCuotas, setEditandoCuotas] = useState(false);

  async function anular(id: number | string) {
    if (!motivo.trim()) {
      setError("Escribí el motivo de la anulación.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/pagos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, motivo: motivo.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo anular");
      setAnulandoId(null);
      setMotivo("");
      onRegistrado();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">{alumno.alumno}</h2>
            <p className="text-sm text-neutral-500">{alumno.organizacion}</p>
            {alumno.nombre_cliente && (
              <p className="text-xs text-neutral-400">Paga: {alumno.nombre_cliente}</p>
            )}
          </div>
          <SituacionPill situacion={alumno.situacion} />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total asignado" value={formatMoney(alumno.total_asignado)} />
          <Stat label="Pagado" value={formatMoney(alumno.montoPagadoTotal)} />
          <Stat label="Saldo" value={formatMoney(alumno.saldo)} highlight />
          <Stat label="Monto por cuota" value={formatMoney(alumno.montoCuota)} />
          <Stat label="Plan de cuotas" value={String(alumno.plan_cuotas)} />
          <Stat label="Cuotas pagadas" value={String(alumno.cuotasPagadas)} />
          <Stat label="Cuotas pendientes" value={String(alumno.cuotasPendientes)} highlight />
          <div>
            <p className="text-xs text-neutral-500">Cuotas atrasadas</p>
            <p className={`text-sm font-bold ${alumno.cuotasAtrasadas > 0 ? "text-red-600" : "text-neutral-700"}`}>
              {alumno.cuotasAtrasadas}
            </p>
          </div>
          <Stat
            label="Próx. vencimiento"
            value={alumno.proximoVencimiento ? formatDate(alumno.proximoVencimiento) : "—"}
          />
        </div>

        {alumno.bonificacionTotal > 0 && (
          <p className="mt-3 text-xs text-neutral-500">
            Bonificaciones otorgadas: {formatMoney(alumno.bonificacionTotal)}.
          </p>
        )}

        {/*
          Precio = saldo pendiente (lo único que realmente puede estar pendiente). Los otros 3
          son PROYECCIONES de "cuánto pagaría si viene HOY" según cómo pague — se calculan
          sobre el saldo y dan $0 solos cuando ya no debe nada (computeAlumno). Si además ya se
          le cobró recargo antes (pagos ya registrados), se lo mostramos aparte como referencia
          histórica, sin mezclarlo con la proyección.
        */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-emerald-700 p-4 text-white">
            <p className="text-xs text-emerald-100">Precio — saldo pendiente</p>
            <p className="text-2xl font-bold">{formatMoney(alumno.saldo)}</p>
            <p className="mt-1 text-xs text-emerald-100">
              {alumno.saldo > 0 ? "Pendiente de cobro" : "Pagado"}
            </p>
          </div>
          <RecargoCard
            color="amber"
            titulo="Interés por cuota vencida"
            total={alumno.totalConInteresAtraso}
            saldo={alumno.saldo}
            detalle="si paga atrasado"
            historico={alumno.interesAtrasoTotal}
          />
          <RecargoCard
            color="sky"
            titulo="Precio de lista (no efectivo)"
            total={alumno.totalPrecioDeLista}
            saldo={alumno.saldo}
            detalle="transferencia/débito/crédito en 1 pago"
            historico={alumno.interesListaTotal}
          />
          <RecargoCard
            color="indigo"
            titulo="Tarjeta en 3 pagos"
            total={alumno.totalTarjeta3Cuotas}
            saldo={alumno.saldo}
            detalle="tarjeta en 3 pagos"
          />
        </div>
      </Card>

      {editandoCuotas && (
        <EditarCuotasForm
          alumno={alumno}
          onGuardado={() => { setEditandoCuotas(false); onRegistrado(); }}
          onCancel={() => setEditandoCuotas(false)}
        />
      )}

      {/* Plan de cuotas: vencimiento y estado de cada mes */}
      {alumno.cuotasPlan.length > 0 && (
        <Card className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-3">
            <div>
              <p className="text-sm font-semibold text-neutral-800">
                Plan de cuotas
                {alumno.cuotasManualActivas && (
                  <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                    Importes cargados a mano
                  </span>
                )}
              </p>
              <p className="text-xs text-neutral-400">Fecha de vencimiento y estado de cada cuota.</p>
            </div>
            {!editandoCuotas && (
              <button
                type="button"
                onClick={() => setEditandoCuotas(true)}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                ✎ Cargar importes a mano
              </button>
            )}
          </div>
          <div className="thin-scroll max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="p-3">Cuota</th>
                  <th className="p-3">Vencimiento</th>
                  <th className="p-3">Monto</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {alumno.cuotasPlan.map((c) => (
                  <tr key={c.numero} className="border-t border-neutral-100">
                    <td className="p-3 font-medium">{c.numero}°</td>
                    <td className="p-3">{c.vencimiento ? formatDate(c.vencimiento) : "—"}</td>
                    <td className="p-3">{formatMoney(c.monto)}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_CUOTA[c.estado].cls}`}>
                        {ESTADO_CUOTA[c.estado].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <PagoForm
        alumnoId={alumno.alumno_id}
        montoCuota={alumno.montoCuota}
        cuotasRestantes={alumno.cuotasPendientes}
        onRegistrado={onRegistrado}
      />

      <div>
        <p className="mb-2 text-sm font-semibold text-neutral-800">
          Pagos registrados desde la app ({alumno.pagos.length})
        </p>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        {alumno.pagos.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Todavía no cargaste pagos nuevos para este alumno.
            {alumno.monto_pagado_base > 0 && (
              <> El pagado inicial ({formatMoney(alumno.monto_pagado_base)}) viene de la planilla.</>
            )}
          </p>
        ) : (
          <Card className="p-0">
            <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Total pagado</th>
                  <th className="p-3">Cuota</th>
                  <th className="p-3">Forma</th>
                  <th className="p-3">Interés</th>
                  <th className="p-3">Bonificación</th>
                  <th className="p-3">Nota</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {alumno.pagos.map((p) => {
                  const { grupoId } = parseNota(p.nota);
                  const hermanos = grupoId
                    ? alumno.pagos.filter((h) => h.id !== p.id && parseNota(h.nota).grupoId === grupoId)
                    : [];
                  return (
                    <PagoRow
                      key={p.id}
                      p={p}
                      hermanos={hermanos}
                      anulando={anulandoId === p.id}
                      motivo={motivo}
                      saving={saving}
                      onStart={() => { setAnulandoId(p.id); setMotivo(""); setError(null); }}
                      onCancel={() => { setAnulandoId(null); setMotivo(""); }}
                      onMotivo={setMotivo}
                      onConfirm={() => anular(p.id)}
                    />
                  );
                })}
              </tbody>
            </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function PagoRow({
  p,
  hermanos,
  anulando,
  motivo,
  saving,
  onStart,
  onCancel,
  onMotivo,
  onConfirm,
}: {
  p: AlumnoComputed["pagos"][number];
  hermanos: AlumnoComputed["pagos"];
  anulando: boolean;
  motivo: string;
  saving: boolean;
  onStart: () => void;
  onCancel: () => void;
  onMotivo: (v: string) => void;
  onConfirm: () => void;
}) {
  const { texto: notaVisible } = parseNota(p.nota);
  const esDividido = hermanos.length > 0;
  const totalGrupo = esDividido ? p.monto + hermanos.reduce((acc, h) => acc + h.monto, 0) : p.monto;
  return (
    <>
      <tr className="border-t border-neutral-100">
        <td className="p-3">{formatDate(p.fecha)}</td>
        <td className="p-3 font-medium">
          {formatMoney(p.monto + (p.interes || 0))}
          {esDividido && (
            <span className="ml-1 text-[11px] font-normal text-neutral-400" title="Este cobro se dividió en varias formas de pago">
              (1 de {hermanos.length + 1})
            </span>
          )}
        </td>
        <td className="p-3">{formatMoney(p.monto)}</td>
        <td className="p-3">{p.forma_de_pago}</td>
        <td className="p-3">
          {p.interes ? `${formatMoney(p.interes)}${p.interes_pct ? ` (${p.interes_pct}%)` : ""}` : "—"}
        </td>
        <td className="p-3">{p.bonificacion ? formatMoney(p.bonificacion) : "—"}</td>
        <td className="p-3 text-neutral-500">{notaVisible || "—"}</td>
        <td className="p-3 text-right">
          {!anulando && (
            <button
              onClick={onStart}
              className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Anular
            </button>
          )}
        </td>
      </tr>
      {anulando && (
        <tr className="bg-red-50/50">
          <td colSpan={8} className="p-3">
            <p className="mb-2 text-xs font-semibold text-red-700">
              {esDividido
                ? `Este cobro se dividió en ${hermanos.length + 1} formas de pago (total ${formatMoney(totalGrupo)}) — al anular, se anulan TODAS juntas. Indicá el motivo:`
                : `Anular este cobro de ${formatMoney(p.monto)} — indicá el motivo:`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={motivo}
                onChange={(e) => onMotivo(e.target.value)}
                placeholder="Ej.: se cargó por error / el cliente pidió reintegro"
                className="w-full rounded-md border border-neutral-300 p-2 text-sm sm:min-w-64 sm:flex-1"
              />
              <button
                onClick={onConfirm}
                disabled={saving}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {saving ? "Anulando…" : "Confirmar anulación"}
              </button>
              <button
                onClick={onCancel}
                disabled={saving}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Cancelar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const RECARGO_COLORES = {
  amber: { bg: "bg-amber-50", texto: "text-amber-700", valor: "text-amber-900" },
  sky: { bg: "bg-sky-50", texto: "text-sky-700", valor: "text-sky-900" },
  indigo: { bg: "bg-indigo-50", texto: "text-indigo-700", valor: "text-indigo-900" },
} as const;

// Tarjeta de proyección de recargo: cuánto pagaría el alumno HOY con esa forma de pago (ya
// calculado en computeAlumno, encadenado con el de atraso si corresponde). Si además hay un
// monto de ese mismo tipo ya cobrado en pagos anteriores, se muestra aparte como referencia.
function RecargoCard({
  color,
  titulo,
  total,
  saldo,
  detalle,
  historico,
}: {
  color: keyof typeof RECARGO_COLORES;
  titulo: string;
  total: number;
  saldo: number;
  detalle: string;
  historico?: number;
}) {
  const cls = RECARGO_COLORES[color];
  const pctExtra = saldo > 0 && total > 0 ? Math.round((total / saldo - 1) * 1000) / 10 : 0;
  return (
    <div className={`rounded-2xl ${cls.bg} p-4`}>
      <p className={`text-xs ${cls.texto}`}>{titulo}</p>
      <p className={`text-2xl font-bold ${cls.valor}`}>{formatMoney(total)}</p>
      {total > 0 && (
        <p className={`mt-1 text-xs ${cls.texto}`}>
          +{pctExtra}% {detalle}
        </p>
      )}
      {!!historico && (
        <p className={`mt-1 text-xs ${cls.texto}`}>Ya cobrado antes: {formatMoney(historico)}</p>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-sm ${highlight ? "font-bold text-emerald-800" : "font-medium"}`}>{value}</p>
    </div>
  );
}

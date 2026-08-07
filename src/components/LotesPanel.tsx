"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import { Card } from "./ui";

type LoteIntegrante = {
  pago_id: number | string;
  alumno_id: string;
  alumno: string;
  monto: number;
  forma_de_pago: string;
  interes: number;
  interesAtraso: number;
  interesLista: number;
  nota: string;
};

type LoteAnulacion = {
  alumno: string | null;
  monto: number;
  motivo: string;
  usuario: string | null;
  fecha: string;
  totalAntes?: number;
  totalDespues?: number;
};

type Lote = {
  loteId: string;
  colegio: string;
  fecha: string;
  integrantes: LoteIntegrante[];
  totalActivo: number;
  anulaciones: LoteAnulacion[];
};

// Muestra los pagos grupales cargados (varios alumnos cobrados juntos): quién sigue activo, el
// total vigente del lote, y — si se anuló algún integrante — el historial completo: quién, por
// qué, y cómo quedó el total (antes → después). Cada integrante se anula desde su propia ficha
// de alumno (Cuotas y pagos); acá solo se ve el resumen consolidado del cobro grupal.
export default function LotesPanel() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/lotes");
        const data = await res.json();
        if (cancel) return;
        if (!res.ok) throw new Error(data.error || "Error cargando pagos grupales");
        setLotes(data.lotes);
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

  if (loading) return <p className="text-sm text-neutral-400">Cargando pagos grupales…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (lotes.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        Todavía no cargaste ningún pago grupal. Seleccioná varios alumnos del mismo colegio arriba
        y tocá &quot;Registrar pago grupal&quot;.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {lotes.map((lote) => {
        const activos = lote.integrantes.length;
        const anulados = lote.anulaciones.length;
        return (
          <Card key={lote.loteId} className="p-0">
            <button
              type="button"
              onClick={() => setAbierto((v) => (v === lote.loteId ? null : lote.loteId))}
              className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-neutral-800">
                  {lote.colegio || "(sin colegio)"} — {formatDate(lote.fecha)}
                </p>
                <p className="text-xs text-neutral-500">
                  {activos} integrante{activos !== 1 ? "s" : ""} activo{activos !== 1 ? "s" : ""}
                  {anulados > 0 && (
                    <span className="text-red-600"> · {anulados} anulado{anulados !== 1 ? "s" : ""}</span>
                  )}
                </p>
              </div>
              <p className="text-lg font-bold text-emerald-800">{formatMoney(lote.totalActivo)}</p>
            </button>

            {abierto === lote.loteId && (
              <div className="border-t border-neutral-100 p-5 pt-3">
                {lote.integrantes.length > 0 && (
                  <div className="thin-scroll overflow-x-auto">
                    <table className="w-full min-w-[32rem] text-sm">
                      <thead className="text-left text-xs text-neutral-500">
                        <tr>
                          <th className="py-1.5 pr-3">Alumno</th>
                          <th className="py-1.5 pr-3">Monto</th>
                          <th className="py-1.5 pr-3">Forma</th>
                          <th className="py-1.5 pr-3">Interés</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lote.integrantes.map((i) => (
                          <tr key={i.pago_id} className="border-t border-neutral-100">
                            <td className="py-1.5 pr-3">{i.alumno}</td>
                            <td className="py-1.5 pr-3">{formatMoney(i.monto)}</td>
                            <td className="py-1.5 pr-3">{i.forma_de_pago}</td>
                            <td className="py-1.5 pr-3">{i.interes ? formatMoney(i.interes) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {lote.anulaciones.length > 0 && (
                  <div className="mt-3 rounded-lg bg-red-50/60 p-3">
                    <p className="mb-1 text-xs font-semibold text-red-700">
                      Anulaciones de este pago grupal
                    </p>
                    <ul className="space-y-1.5 text-xs text-red-800">
                      {lote.anulaciones.map((a, idx) => (
                        <li key={idx}>
                          <span className="font-medium">{a.alumno ?? "(alumno no encontrado)"}</span>{" "}
                          — {formatMoney(a.monto)} anulado el {formatDate(a.fecha)}
                          {a.usuario && <> por {a.usuario}</>}. Motivo: {a.motivo || "—"}.
                          {a.totalAntes !== undefined && a.totalDespues !== undefined && (
                            <>
                              {" "}
                              Total del lote: {formatMoney(a.totalAntes)} → {formatMoney(a.totalDespues)}.
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card } from "./ui";

type Registro = {
  id: number;
  usuario_email: string | null;
  accion: string;
  entidad: string | null;
  detalle: Record<string, unknown> | null;
  creado_en: string;
};

const ACCION_LABEL: Record<string, string> = {
  registrar_pago: "Registró un pago",
  aprobar_usuario: "Aprobó un usuario",
  rechazar_usuario: "Rechazó un usuario",
};

function fechaHora(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditoriaView() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/auditoria");
        const d = await res.json();
        if (cancel) return;
        if (!res.ok) throw new Error(d.error || "Error");
        setRegistros(d.registros);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Auditoría</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Registro de quién hizo qué y cuándo (pagos cargados, aprobaciones, etc.).
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <p className="text-sm text-neutral-400">Cargando…</p>
      ) : (
        <Card className="p-0">
          <div className="thin-scroll max-h-[36rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="p-3">Fecha y hora</th>
                  <th className="p-3">Usuario</th>
                  <th className="p-3">Acción</th>
                  <th className="p-3">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="whitespace-nowrap p-3 text-neutral-600">{fechaHora(r.creado_en)}</td>
                    <td className="p-3">{r.usuario_email || "—"}</td>
                    <td className="p-3 font-medium">{ACCION_LABEL[r.accion] ?? r.accion}</td>
                    <td className="p-3 text-neutral-500">
                      {r.detalle ? resumenDetalle(r.detalle) : r.entidad || "—"}
                    </td>
                  </tr>
                ))}
                {registros.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-neutral-400">
                      Todavía no hay actividad registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function resumenDetalle(d: Record<string, unknown>): string {
  const partes: string[] = [];
  if (d.alumno) partes.push(String(d.alumno));
  if (d.monto != null) partes.push("$ " + Math.round(Number(d.monto)).toLocaleString("es-AR"));
  if (d.forma_de_pago) partes.push(String(d.forma_de_pago));
  return partes.join(" · ") || JSON.stringify(d);
}

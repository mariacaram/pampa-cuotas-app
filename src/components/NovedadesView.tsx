"use client";

import { useEffect, useState } from "react";
import { Card } from "./ui";
import { formatMoney } from "@/lib/format";

// Guarda el id de la última anulación ya vista (para el puntito rojo).
export const NOVEDADES_SEEN_KEY = "pampa_novedades_seen";

type Anulacion = {
  id: number;
  usuario_email: string | null;
  creado_en: string;
  detalle: {
    alumno?: string | null;
    colegio?: string | null;
    monto?: number;
    fecha?: string;
    forma_de_pago?: string;
    motivo?: string;
  } | null;
};

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

export default function NovedadesView({ onSeen }: { onSeen?: () => void }) {
  const [items, setItems] = useState<Anulacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/novedades");
        const d = await res.json();
        if (cancel) return;
        if (!res.ok) throw new Error(d.error || "Error cargando novedades");
        const list = (d.anulaciones as Anulacion[]) ?? [];
        setItems(list);
        // Marcar todo como visto: guardo el id más alto.
        const maxId = list.reduce((m, x) => Math.max(m, x.id), 0);
        if (maxId > 0) localStorage.setItem(NOVEDADES_SEEN_KEY, String(maxId));
        onSeen?.();
      } catch (e) {
        if (!cancel) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Novedades</h1>
        <p className="mt-1 text-sm text-neutral-500">Anulaciones de pago recientes.</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-neutral-400">Cargando…</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">Todavía no hay anulaciones registradas. 🎉</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900">
                    {a.detalle?.alumno ?? "—"}
                    {a.detalle?.colegio ? (
                      <span className="font-normal text-neutral-400"> · {a.detalle.colegio}</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-red-700">
                    Pago anulado: <b>{formatMoney(a.detalle?.monto ?? 0)}</b>
                    {a.detalle?.forma_de_pago ? ` (${a.detalle.forma_de_pago})` : ""}
                  </p>
                  {a.detalle?.motivo ? (
                    <p className="mt-1 text-sm text-neutral-600">Motivo: {a.detalle.motivo}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-xs text-neutral-400">
                  <p>{fechaHora(a.creado_en)}</p>
                  {a.usuario_email ? <p className="mt-0.5">por {a.usuario_email}</p> : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

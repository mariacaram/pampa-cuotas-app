"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Colegio } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Card, StatCard } from "./ui";
import { Reveal, Stagger, StaggerItem } from "./motion/Reveal";
import ColegioCombobox from "./ColegioCombobox";
import Donut from "./charts/Donut";
import BarList from "./charts/BarList";
import ProyeccionModal from "./ProyeccionModal";

type Proyeccion = {
  scope: string;
  total: number;
  vencido: { monto: number; cuotas: number };
  meses: { mes: string; monto: number; cuotas: number }[];
};

type Stats = {
  scope: string;
  totalAlumnos: number;
  totalAsignado: number;
  totalCobrado: number;
  saldoPendiente: number;
  pctCobrado: number;
  situacion: { PAGO_TOTAL: number; PAGO_PARCIAL: number; SIN_PAGOS: number };
  topColegiosPorSaldo: { organizacion: string; saldo: number; alumnos: number }[];
  formasDePago: { forma: string; cantidad: number }[];
};

export default function TableroView({ colegios }: { colegios: Colegio[] }) {
  const [colegio, setColegio] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de proyección mensual (detalle del saldo pendiente).
  const [proyOpen, setProyOpen] = useState(false);
  const [proy, setProy] = useState<Proyeccion | null>(null);
  const [proyLoading, setProyLoading] = useState(false);

  async function abrirProyeccion() {
    setProyOpen(true);
    setProy(null);
    setProyLoading(true);
    try {
      const url = colegio
        ? `/api/proyeccion?organizacion=${encodeURIComponent(colegio)}`
        : "/api/proyeccion";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setProy(data.proyeccion);
    } catch {
      // se muestra el estado de carga; el usuario puede cerrar
    } finally {
      setProyLoading(false);
    }
  }

  useEffect(() => {
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const url = colegio
          ? `/api/stats?organizacion=${encodeURIComponent(colegio)}`
          : "/api/stats";
        const res = await fetch(url);
        const data = await res.json();
        if (cancel) return;
        if (!res.ok) throw new Error(data.error || "Error cargando estadísticas");
        setStats(data.stats);
      } catch (e) {
        if (!cancel) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [colegio]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Tablero de datos</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Resumen de cobranzas {stats ? `· ${stats.scope}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-neutral-500">Filtrar por colegio</label>
            <ColegioCombobox
              colegios={colegios}
              value={colegio}
              onChange={setColegio}
              className="mt-1 w-full sm:w-72"
            />
          </div>
          {colegio ? (
            <a
              href={`/api/export?organizacion=${encodeURIComponent(colegio)}`}
              className="btn btn-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              ⬇ Reporte del colegio
            </a>
          ) : (
            <a
              href="/api/export"
              className="btn btn-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              ⬇ Descargar reporte completo
            </a>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading && !stats ? (
        <StatsSkeleton />
      ) : stats ? (
        <>
          <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StaggerItem>
              <StatCard label="Alumnos" animateTo={stats.totalAlumnos} format={(n) => Math.round(n).toLocaleString("es-AR")} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Total asignado" animateTo={stats.totalAsignado} format={formatMoney} />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Cobrado"
                animateTo={stats.totalCobrado}
                format={formatMoney}
                sub={`${stats.pctCobrado}% del total`}
                accent
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Saldo pendiente"
                animateTo={stats.saldoPendiente}
                format={formatMoney}
                onClick={abrirProyeccion}
              />
            </StaggerItem>
          </Stagger>

          {/* Barra de progreso de cobranza */}
          <Reveal><Card>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-neutral-800">Cobrado vs pendiente</span>
              <span className="text-neutral-500">{stats.pctCobrado}% cobrado</span>
            </div>
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-neutral-100">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${stats.pctCobrado}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-neutral-500">
              <span>Cobrado: {formatMoney(stats.totalCobrado)}</span>
              <span>Pendiente: {formatMoney(stats.saldoPendiente)}</span>
            </div>
          </Card></Reveal>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Reveal><Card>
              <p className="mb-4 font-semibold text-neutral-800">Estado de pagos</p>
              <Donut
                centerValue={String(stats.totalAlumnos)}
                centerLabel="alumnos"
                segments={[
                  { label: "Pagó todo", value: stats.situacion.PAGO_TOTAL, color: "#3072b4" },
                  { label: "Pago parcial", value: stats.situacion.PAGO_PARCIAL, color: "#f4a72e" },
                  { label: "Sin pagos", value: stats.situacion.SIN_PAGOS, color: "#c7d2dc" },
                ]}
              />
            </Card></Reveal>

            <Reveal delay={0.08}><Card>
              <p className="mb-4 font-semibold text-neutral-800">Formas de pago</p>
              <BarList
                items={stats.formasDePago.map((f) => ({ label: f.forma, value: f.cantidad }))}
                barClass="bg-emerald-400"
              />
            </Card></Reveal>
          </div>

          {stats.topColegiosPorSaldo.length > 0 && (
            <Reveal><Card>
              <p className="mb-4 font-semibold text-neutral-800">
                {colegio ? "Saldo pendiente del colegio" : "Colegios que más deben"}
              </p>
              <BarList
                items={stats.topColegiosPorSaldo.map((c) => ({
                  label: c.organizacion,
                  value: c.saldo,
                  hint: `· ${c.alumnos} al.`,
                }))}
                formatValue={formatMoney}
                barClass="bg-emerald-600"
              />
            </Card></Reveal>
          )}
        </>
      ) : null}

      {proyOpen && (
        <ProyeccionModal
          proyeccion={proy}
          loading={proyLoading}
          organizacion={colegio}
          onClose={() => setProyOpen(false)}
        />
      )}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="animate-fade space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-neutral-200/60" />
        ))}
      </div>
      <div className="h-20 rounded-2xl bg-neutral-200/50" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-56 rounded-2xl bg-neutral-200/50" />
        <div className="h-56 rounded-2xl bg-neutral-200/50" />
      </div>
    </div>
  );
}

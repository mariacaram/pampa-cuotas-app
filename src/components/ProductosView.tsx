"use client";

import { useEffect, useMemo, useState } from "react";
import { Colegio } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Card, StatCard } from "./ui";
import BarList from "./charts/BarList";
import { Stagger, StaggerItem } from "./motion/Reveal";

type ProductoStat = { producto: string; pedidos: number; facturacion: number };
type ComboStat = { combo: string; pedidos: number };
type ComboOficial = { combo: string; nombre: string; pedidos: number; facturacion: number };
type Productos = {
  scope: string;
  totalPedidos: number;
  porProducto: ProductoStat[];
  topCombos: ComboStat[];
  porCombo: ComboOficial[];
};

export default function ProductosView({ colegios }: { colegios: Colegio[] }) {
  const [filtro, setFiltro] = useState("");
  const [colegio, setColegio] = useState("");
  const [data, setData] = useState<Productos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const url = colegio ? `/api/productos?organizacion=${encodeURIComponent(colegio)}` : "/api/productos";
        const res = await fetch(url);
        const d = await res.json();
        if (cancel) return;
        if (!res.ok) throw new Error(d.error || "Error cargando productos");
        setData(d.productos);
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

  const colegiosFiltrados = useMemo(() => {
    const q = filtro.trim().toLocaleLowerCase("es");
    if (!q) return colegios;
    return colegios.filter((c) => c.organizacion.toLocaleLowerCase("es").includes(q));
  }, [colegios, filtro]);

  const totalPrendas = data ? data.porProducto.reduce((s, p) => s + p.pedidos, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Productos estrella</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Qué prendas y combos se piden más{data ? ` · ${data.scope}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-neutral-500">Filtrar por colegio</label>
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar…"
              className="mt-1 w-44 rounded-lg border border-neutral-300 p-2 text-sm"
            />
          </div>
          <select
            value={colegio}
            onChange={(e) => setColegio(e.target.value)}
            className="rounded-lg border border-neutral-300 p-2 text-sm"
          >
            <option value="">Todos los colegios ({colegios.length})</option>
            {colegiosFiltrados.map((c) => (
              <option key={c.organizacion} value={c.organizacion}>
                {c.organizacion} ({c.cantidadAlumnos})
              </option>
            ))}
          </select>
          <a
            href={`/api/productos/export${colegio ? `?organizacion=${encodeURIComponent(colegio)}` : ""}`}
            className="btn btn-primary rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            ⬇ Excel
          </a>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading && !data ? (
        <p className="text-sm text-neutral-400">Cargando…</p>
      ) : data ? (
        <>
          <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StaggerItem>
              <StatCard label="Pedidos" animateTo={data.totalPedidos} format={(n) => Math.round(n).toLocaleString("es-AR")} accent />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Prendas vendidas" animateTo={totalPrendas} format={(n) => Math.round(n).toLocaleString("es-AR")} />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Prenda #1"
                value={data.porProducto[0]?.producto ?? "—"}
                sub={data.porProducto[0] ? `${data.porProducto[0].pedidos} pedidos` : ""}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Combo #1"
                value={data.topCombos[0]?.combo ?? "—"}
                sub={data.topCombos[0] ? `${data.topCombos[0].pedidos} pedidos` : ""}
              />
            </StaggerItem>
          </Stagger>

          <Card className="p-0">
            <div className="border-b border-neutral-100 px-5 py-3">
              <p className="text-sm font-semibold text-neutral-800">Por combo del flyer</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="p-3">Combo</th>
                  <th className="p-3">Pedidos</th>
                  <th className="p-3">% de pedidos</th>
                  <th className="p-3">Facturación</th>
                </tr>
              </thead>
              <tbody>
                {data.porCombo.map((c) => (
                  <tr key={c.combo} className="border-t border-neutral-100">
                    <td className="p-3 font-medium">{c.nombre}</td>
                    <td className="p-3">{c.pedidos.toLocaleString("es-AR")}</td>
                    <td className="p-3">
                      {data.totalPedidos > 0 ? Math.round((c.pedidos / data.totalPedidos) * 100) : 0}%
                    </td>
                    <td className="p-3">{formatMoney(c.facturacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <p className="mb-4 font-semibold text-neutral-800">Prendas más pedidas</p>
              <BarList
                items={data.porProducto.map((p) => ({
                  label: p.producto,
                  value: p.pedidos,
                  hint: `· ${formatMoney(p.facturacion)}`,
                }))}
                barClass="bg-emerald-500"
              />
            </Card>

            <Card>
              <p className="mb-4 font-semibold text-neutral-800">Combos más pedidos</p>
              <BarList
                items={data.topCombos.map((c) => ({ label: c.combo, value: c.pedidos }))}
                barClass="bg-emerald-400"
              />
            </Card>
          </div>

          <Card className="p-0">
            <div className="border-b border-neutral-100 px-5 py-3">
              <p className="text-sm font-semibold text-neutral-800">Detalle por producto</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Pedidos</th>
                  <th className="p-3">% de pedidos</th>
                  <th className="p-3">Facturación aprox.</th>
                </tr>
              </thead>
              <tbody>
                {data.porProducto.map((p) => (
                  <tr key={p.producto} className="border-t border-neutral-100">
                    <td className="p-3 font-medium">{p.producto}</td>
                    <td className="p-3">{p.pedidos.toLocaleString("es-AR")}</td>
                    <td className="p-3">
                      {data.totalPedidos > 0 ? Math.round((p.pedidos / data.totalPedidos) * 100) : 0}%
                    </td>
                    <td className="p-3">{formatMoney(p.facturacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <p className="text-xs text-neutral-400">
            La facturación por producto es orientativa: reparte el total de cada pedido entre las
            prendas que lo componen.
          </p>
        </>
      ) : null}
    </div>
  );
}

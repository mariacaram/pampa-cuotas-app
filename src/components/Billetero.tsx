"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { Card } from "./ui";

// Denominaciones de billetes en circulación (mismo orden que la planilla de arqueo en papel).
const DENOMINACIONES = [50, 100, 200, 500, 1000, 2000, 10000, 20000];

// Arqueo de caja: cargás CUÁNTOS billetes de cada denominación tenés en la mano, y compara el
// total contra lo que el reporte dice que deberías haber cobrado en efectivo — si no cierra,
// muestra la diferencia (a favor o en contra) para poder encontrar el error.
export default function Billetero({ totalEsperado }: { totalEsperado: number }) {
  const [cantidades, setCantidades] = useState<Record<number, string>>({});

  function actualizar(denom: number, valor: string) {
    setCantidades((prev) => ({ ...prev, [denom]: valor }));
  }

  const totalContado = DENOMINACIONES.reduce(
    (acc, d) => acc + d * (Number(cantidades[d]) || 0),
    0
  );
  const diferencia = Math.round(totalContado - totalEsperado);
  const cargoAlgo = DENOMINACIONES.some((d) => (Number(cantidades[d]) || 0) > 0);

  return (
    <Card>
      <p className="mb-1 font-semibold text-neutral-800">Arqueo de caja — billetes en mano</p>
      <p className="mb-4 text-xs text-neutral-500">
        Contá cuántos billetes de cada uno tenés y comparalo contra el total en efectivo del
        período ({formatMoney(totalEsperado)}).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full max-w-sm text-sm">
          <thead className="text-left text-xs text-neutral-500">
            <tr>
              <th className="py-1">Billete</th>
              <th className="py-1">Cantidad</th>
              <th className="py-1 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {DENOMINACIONES.map((d) => {
              const cant = Number(cantidades[d]) || 0;
              return (
                <tr key={d} className="border-t border-neutral-100">
                  <td className="py-1.5">{formatMoney(d)}</td>
                  <td className="py-1.5">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={cantidades[d] ?? ""}
                      onChange={(e) => actualizar(d, e.target.value)}
                      placeholder="0"
                      className="w-20 rounded-md border border-neutral-300 p-1.5 text-sm"
                    />
                  </td>
                  <td className="py-1.5 text-right text-neutral-600">
                    {cant > 0 ? formatMoney(d * cant) : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-neutral-300 font-semibold">
              <td className="py-2" colSpan={2}>
                Total contado
              </td>
              <td className="py-2 text-right">{formatMoney(totalContado)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {cargoAlgo && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm font-semibold ${
            diferencia === 0
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {diferencia === 0
            ? "✓ Cierra exacto con el reporte."
            : diferencia > 0
              ? `Sobran ${formatMoney(diferencia)} respecto del reporte.`
              : `Faltan ${formatMoney(-diferencia)} respecto del reporte.`}
        </div>
      )}
    </Card>
  );
}

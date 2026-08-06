"use client";

import { motion, useReducedMotion } from "framer-motion";

export type BarItem = { label: string; value: number; hint?: string };

type Props = {
  items: BarItem[];
  formatValue?: (n: number) => string;
  barClass?: string;
};

// Ranking de barras horizontales; las barras "crecen" al aparecer.
export default function BarList({ items, formatValue, barClass = "bg-emerald-500" }: Props) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pct = Math.max(3, (item.value / max) * 100);
        return (
          <div key={item.label} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-neutral-700 transition-colors group-hover:text-neutral-900" title={item.label}>
                {item.label}
              </span>
              <span className="whitespace-nowrap font-semibold text-neutral-900">
                {formatValue ? formatValue(item.value) : item.value}
                {item.hint && <span className="ml-1 font-normal text-neutral-400">{item.hint}</span>}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <motion.div
                className={`h-full rounded-full ${barClass}`}
                initial={reduce ? false : { width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: Math.min(i * 0.05, 0.4) }}
              />
            </div>
          </div>
        );
      })}
      {items.length === 0 && <p className="text-sm text-neutral-400">Sin datos.</p>}
    </div>
  );
}

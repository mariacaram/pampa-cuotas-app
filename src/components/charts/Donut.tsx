"use client";

import { motion, useReducedMotion } from "framer-motion";

export type DonutSegment = { label: string; value: number; color: string };

type Props = {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
};

// Dona SVG liviana (sin librerías). Dibuja cada segmento con stroke-dasharray.
export default function Donut({ segments, centerLabel, centerValue }: Props) {
  const reduce = useReducedMotion();
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = 60;
  const stroke = 22;
  const circ = 2 * Math.PI * radius;

  const arcs = segments.map((seg, i) => {
    const prevValue = segments.slice(0, i).reduce((s, x) => s + x.value, 0);
    const dash = (seg.value / total) * circ;
    return {
      color: seg.color,
      dash,
      dasharray: `${dash} ${circ - dash}`,
      dashoffset: -(prevValue / total) * circ,
    };
  });

  return (
    <div className="flex items-center gap-5">
      <motion.svg
        viewBox="0 0 160 160"
        className="h-40 w-40 -rotate-90"
        initial={reduce ? false : { scale: 0.85, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#e6ecf3" strokeWidth={stroke} />
        {arcs.map((a, i) => (
          <motion.circle
            key={i}
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeDashoffset={a.dashoffset}
            strokeLinecap="butt"
            initial={reduce ? false : { strokeDasharray: `0 ${circ}` }}
            whileInView={{ strokeDasharray: a.dasharray }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.12 }}
          />
        ))}
        {centerValue && (
          <text
            x="80"
            y="76"
            textAnchor="middle"
            transform="rotate(90 80 80)"
            fontSize="22"
            fontWeight="700"
            fill="#14261e"
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x="80"
            y="96"
            textAnchor="middle"
            transform="rotate(90 80 80)"
            fontSize="10"
            fill="#6b7c74"
          >
            {centerLabel}
          </text>
        )}
      </motion.svg>
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-sm" style={{ background: seg.color }} />
            <span className="text-neutral-600">{seg.label}</span>
            <span className="font-semibold text-neutral-900">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Anima un número desde 0 hasta `value` al montar, formateándolo con `format`.
export default function CountUp({
  value,
  format,
  duration = 1.1,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const prev = useRef(0);

  useEffect(() => {
    if (reduce) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value);
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return <>{format(display)}</>;
}

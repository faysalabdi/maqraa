"use client";

import { useEffect, useMemo, useState } from "react";

const COLORS = ["#0f9663", "#e3a72f", "#5b6cf0", "#f0762e", "#0c7a51"];
const COUNT = 34;
const LIFETIME_MS = 2600;

/**
 * A one-shot burst. Mount it with a changing `key` to fire again — the
 * particles are positioned once and then left to the compositor, so nothing
 * re-renders while they fall.
 */
export function Confetti({ onDone }: { onDone?: () => void }) {
  const [gone, setGone] = useState(false);

  const particles = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        left: Math.random() * 96 + 2,
        delay: Math.random() * 0.45,
        duration: 1.5 + Math.random() * 1.1,
        color: COLORS[i % COLORS.length],
        width: 6 + Math.round(Math.random() * 4),
        height: 9 + Math.round(Math.random() * 6),
        round: i % 3 === 0,
        drift: Math.round((Math.random() - 0.5) * 120),
      })),
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setGone(true);
      onDone?.();
    }, LIFETIME_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  if (gone) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p, i) => (
        <span
          key={i}
          className="animate-confetti absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            background: p.color,
            borderRadius: p.round ? "9999px" : 2,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--confetti-drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

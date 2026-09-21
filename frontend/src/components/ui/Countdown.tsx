import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Countdown({ expiresAt, className = "" }: { expiresAt: string; className?: string }) {
  const target = new Date(expiresAt).getTime();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = target - now;
  const expired = remaining <= 0;

  return (
    <span
      className={`tabular font-mono text-sm ${expired ? "text-[var(--color-risk-high)]" : "text-[var(--color-text)]"} ${className}`}
      aria-live="polite"
    >
      {expired ? "Expired" : formatRemaining(remaining)}
    </span>
  );
}

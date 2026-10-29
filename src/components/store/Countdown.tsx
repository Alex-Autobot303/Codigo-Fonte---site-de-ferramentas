import { useEffect, useState } from "react";

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const diff = Math.max(0, new Date(to).getTime() - now);
  if (diff === 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  const box = (v: number, l: string) => (
    <div className="flex flex-col items-center rounded-lg border border-violet/40 bg-violet/10 px-2.5 py-1">
      <span className="font-display text-lg font-bold tabular-nums">
        {String(v).padStart(2, "0")}
      </span>
      <span className="text-[10px] uppercase text-muted-foreground">{l}</span>
    </div>
  );
  return (
    <div className="flex gap-1.5">
      {box(d, "dias")}
      {box(h, "hrs")}
      {box(m, "min")}
      {box(s, "seg")}
    </div>
  );
}

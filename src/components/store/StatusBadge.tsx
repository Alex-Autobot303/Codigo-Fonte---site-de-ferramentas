import { statusLabel } from "@/lib/format";

const tone: Record<string, string> = {
  pendente: "bg-warning/15 text-warning",
  pago: "bg-primary/15 text-primary",
  entregue: "bg-success/15 text-success",
  cancelado: "bg-muted text-muted-foreground",
  reembolsado: "bg-violet/15 text-violet",
  aguardando: "bg-warning/15 text-warning",
  problema: "bg-destructive/15 text-destructive",
  aberto: "bg-warning/15 text-warning",
  respondido: "bg-primary/15 text-primary",
  fechado: "bg-muted text-muted-foreground",
};

export function StatusBadge({ s }: { s: string }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[s] ?? "bg-muted"}`}>{statusLabel[s] ?? s}</span>;
}

export const brl = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dateBR = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export const statusLabel: Record<string, string> = {
  pendente: "Aguardando pagamento",
  pago: "Pago",
  entregue: "Entregue",
  cancelado: "Cancelado",
  reembolsado: "Reembolsado",
  aguardando: "Aguardando entrega",
  problema: "Com problema",
  aberto: "Aberto",
  respondido: "Respondido",
  fechado: "Fechado",
};

export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Algo deu errado. Tente novamente.";
}

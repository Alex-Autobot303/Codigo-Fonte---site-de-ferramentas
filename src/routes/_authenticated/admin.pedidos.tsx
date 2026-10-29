import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR, errMsg } from "@/lib/format";
import { StatusBadge } from "@/components/store/StatusBadge";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({ component: AdminOrders });

function AdminOrders() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data: orders } = await supabase.from("orders").select("*, order_items(product_name, quantity)").order("created_at", { ascending: false }).limit(500);
      const ids = [...new Set((orders ?? []).map((o) => o.user_id))];
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (orders ?? []).map((o) => ({ ...o, customer: map.get(o.user_id) }));
    },
  });
  const list = data.filter((o) => {
    const hay = `${o.number} ${o.customer?.full_name ?? ""} ${o.customer?.email ?? ""} ${o.order_items.map((i) => i.product_name).join(" ")}`.toLowerCase();
    return (!q || hay.includes(q.toLowerCase())) && (!status || o.status === status);
  });

  const act = async (fn: "admin_confirm_payment" | "admin_cancel_order", id: string, extra: Record<string, unknown> = {}) => {
    const msg = fn === "admin_confirm_payment" ? "Confirmar que o pagamento deste pedido foi recebido (ex.: PIX manual)?" : extra._refund ? "Reembolsar valor para a carteira do cliente?" : "Cancelar este pedido?";
    if (!confirm(msg)) return;
    const { error } = await supabase.rpc(fn, { _order: id, ...extra } as never);
    if (error) return toast.error(errMsg(error));
    toast.success("Pedido atualizado");
    qc.invalidateQueries();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Nº, cliente ou produto" value={q} onChange={(e) => setQ(e.target.value)} className="w-60" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Todos</option>
            {["pendente", "pago", "entregue", "cancelado", "reembolsado"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Nº</th><th className="p-3">Cliente</th><th className="p-3">Produtos</th><th className="p-3">Valor</th><th className="p-3">Pagamento</th><th className="p-3">Data</th><th className="p-3">Status</th><th className="p-3">Ações</th></tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className="border-t border-border align-top">
                <td className="p-3 font-semibold">#{o.number}</td>
                <td className="p-3">{o.customer?.full_name ?? "—"}<div className="text-xs text-muted-foreground">{o.customer?.email}</div></td>
                <td className="p-3 text-muted-foreground">{o.order_items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}</td>
                <td className="p-3">{brl(o.total)}</td>
                <td className="p-3 text-muted-foreground">{o.payment_method ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{dateBR(o.created_at)}</td>
                <td className="p-3"><StatusBadge s={o.status} /></td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {o.status === "pendente" && <Button size="sm" variant="hero" onClick={() => act("admin_confirm_payment", o.id)}>Confirmar pgto</Button>}
                    {o.status === "pendente" && <Button size="sm" variant="ghost" onClick={() => act("admin_cancel_order", o.id, { _refund: false })}>Cancelar</Button>}
                    {["pago", "entregue"].includes(o.status) && <Button size="sm" variant="ghost" onClick={() => act("admin_cancel_order", o.id, { _refund: true })}>Reembolsar</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

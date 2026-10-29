import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { brl, dateBR, errMsg } from "@/lib/format";
import { StatusBadge } from "@/components/store/StatusBadge";

export const Route = createFileRoute("/_authenticated/conta/pedidos")({ component: Orders });

function Orders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*), deliveries(id, status)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const payWallet = async (id: string) => {
    const { error } = await supabase.rpc("pay_order_with_wallet", { _order: id });
    if (error) return toast.error(errMsg(error));
    toast.success("Pagamento aprovado!");
    qc.invalidateQueries();
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Meus pedidos</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground">Você ainda não fez pedidos.</p>
      ) : (
        <div className="space-y-3">
          {data.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display font-semibold">Pedido #{o.number}</div>
                  <div className="text-xs text-muted-foreground">{dateBR(o.created_at)}</div>
                </div>
                <StatusBadge s={o.status} />
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {o.order_items.map((i) => (
                  <li key={i.id}>
                    {i.quantity}× {i.product_name} — {brl(i.unit_price)}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                <div>
                  {Number(o.discount) > 0 && (
                    <span className="mr-3 text-muted-foreground">Desconto: {brl(o.discount)}</span>
                  )}
                  <span className="font-semibold">Total: {brl(o.total)}</span>
                  {o.payment_method && (
                    <span className="ml-3 text-muted-foreground">via {o.payment_method}</span>
                  )}
                </div>
                {o.status === "pendente" && (
                  <Button size="sm" variant="hero" onClick={() => payWallet(o.id)}>
                    Pagar com saldo
                  </Button>
                )}
                {o.deliveries.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Entregas: {o.deliveries.filter((d) => d.status === "entregue").length}/
                    {o.deliveries.length}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

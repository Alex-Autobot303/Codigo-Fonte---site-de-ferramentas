import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, KeyRound, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { dateBR } from "@/lib/format";
import { StatusBadge } from "@/components/store/StatusBadge";

export const Route = createFileRoute("/_authenticated/conta/entregas")({ component: Deliveries });

function Deliveries() {
  const { user } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ["my-deliveries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*, order_items(product_name), orders(number)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Downloads e licenças</h1>
      {data.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhuma entrega ainda. Elas aparecem aqui após a confirmação do pagamento.
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((d) => (
            <div key={d.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{d.order_items?.product_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Pedido #{d.orders?.number} · {dateBR(d.created_at)}
                  </div>
                </div>
                <StatusBadge s={d.status} />
              </div>
              {d.status === "entregue" && d.content ? (
                d.delivery_type === "arquivo" || /^https?:\/\//.test(d.content) ? (
                  <a
                    href={d.content}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    <Download className="h-4 w-4" /> Acessar download
                  </a>
                ) : (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-background p-3 font-mono text-sm">
                    <KeyRound className="h-4 w-4 text-primary" />
                    <span className="flex-1 break-all">{d.content}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(d.content!);
                        toast.success("Copiado");
                      }}
                      aria-label="Copiar"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                )
              ) : (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" /> Nossa equipe está preparando sua entrega.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

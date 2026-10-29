import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { dateBR, errMsg } from "@/lib/format";
import { StatusBadge } from "@/components/store/StatusBadge";

export const Route = createFileRoute("/_authenticated/admin/entregas")({ component: AdminDeliveries });

function AdminDeliveries() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pendentes");
  const [content, setContent] = useState<Record<string, string>>({});
  const { data = [] } = useQuery({
    queryKey: ["admin-deliveries"],
    queryFn: async () => (await supabase.from("deliveries").select("*, order_items(product_name), orders(number)").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const list = data.filter((d) => filter === "todas" || (filter === "pendentes" ? d.status !== "entregue" : d.status === filter));

  const deliver = async (id: string) => {
    const c = content[id]?.trim();
    if (!c) return toast.error("Informe a licença, link ou instruções");
    const { error } = await supabase.rpc("admin_deliver_manual", { _delivery: id, _content: c });
    if (error) return toast.error(errMsg(error));
    toast.success("Entrega registrada");
    qc.invalidateQueries();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Entregas</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="pendentes">Pendentes e com problema</option>
          <option value="problema">Com problema</option>
          <option value="entregue">Entregues</option>
          <option value="todas">Todas</option>
        </select>
      </div>
      <div className="space-y-3">
        {list.length === 0 && <p className="text-muted-foreground">Nada por aqui.</p>}
        {list.map((d) => (
          <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{d.order_items?.product_name} <span className="text-muted-foreground">· Pedido #{d.orders?.number}</span></div>
                <div className="text-xs text-muted-foreground">{d.delivery_type} · {dateBR(d.created_at)} {d.admin_note && `· ${d.admin_note}`}</div>
              </div>
              <StatusBadge s={d.status} />
            </div>
            <div className="mt-3 flex gap-2">
              <Input placeholder={d.status === "entregue" ? "Reenviar: nova licença, link ou instrução" : "Licença, link de download ou instruções"} value={content[d.id] ?? ""} onChange={(e) => setContent({ ...content, [d.id]: e.target.value })} />
              <Button variant="hero" onClick={() => deliver(d.id)}>{d.status === "entregue" ? "Reenviar" : "Entregar"}</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

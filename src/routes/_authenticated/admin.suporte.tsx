import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dateBR } from "@/lib/format";
import { StatusBadge } from "@/components/store/StatusBadge";
import { TicketThread } from "@/components/store/TicketThread";

export const Route = createFileRoute("/_authenticated/admin/suporte")({ component: AdminSupport });

function AdminSupport() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["tickets", "admin"],
    queryFn: async () => (await supabase.from("support_tickets").select("*").order("updated_at", { ascending: false })).data ?? [],
  });
  const close = async (id: string) => {
    await supabase.from("support_tickets").update({ status: "fechado" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["tickets"] });
  };
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Chamados de suporte</h1>
      <div className="space-y-3">
        {data.length === 0 && <p className="text-muted-foreground">Nenhum chamado.</p>}
        {data.map((t) => (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button className="text-left" onClick={() => setOpen(open === t.id ? null : t.id)}>
                <div className="font-semibold">{t.subject}</div>
                <div className="text-xs text-muted-foreground">{t.protocol} · {t.category} · {dateBR(t.created_at)}</div>
              </button>
              <div className="flex items-center gap-2">
                <StatusBadge s={t.status} />
                {t.status !== "fechado" && <Button size="sm" variant="ghost" onClick={() => close(t.id)}>Fechar</Button>}
              </div>
            </div>
            {open === t.id && <div className="mt-4 border-t border-border pt-4"><TicketThread ticketId={t.id} staff /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

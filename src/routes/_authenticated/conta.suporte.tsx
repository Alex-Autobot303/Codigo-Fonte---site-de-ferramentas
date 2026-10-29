import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { dateBR, errMsg } from "@/lib/format";
import { StatusBadge } from "@/components/store/StatusBadge";
import { TicketThread } from "@/components/store/TicketThread";

export const Route = createFileRoute("/_authenticated/conta/suporte")({ component: Support });

const categories = ["Pedido / pagamento", "Entrega / acesso", "Reembolso", "Dúvida sobre produto", "Privacidade (LGPD)", "Outro"];

function Support() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ category: categories[0], subject: "", body: "" });
  const { data = [] } = useQuery({
    queryKey: ["tickets", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("support_tickets").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const { data: t } = await supabase.from("support_tickets").insert({ user_id: user.id, category: form.category ?? "Outro", subject: form.subject }).select().single().throwOnError();
      await supabase.from("support_messages").insert({ ticket_id: t!.id, author_id: user.id, body: form.body }).throwOnError();
      toast.success(`Chamado ${t!.protocol} aberto`);
      setForm({ category: categories[0], subject: "", body: "" });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      setOpen(t!.id);
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Central de suporte</h1>
      <form onSubmit={create} className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Abrir chamado</h2>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Input required maxLength={150} placeholder="Assunto" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <Textarea required maxLength={5000} placeholder="Descreva o problema (informe o número do pedido, se houver)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <Button variant="hero">Enviar chamado</Button>
      </form>
      <div className="space-y-3">
        {data.map((t) => (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-5">
            <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpen(open === t.id ? null : t.id)}>
              <div>
                <div className="font-semibold">{t.subject}</div>
                <div className="text-xs text-muted-foreground">{t.protocol} · {t.category} · {dateBR(t.created_at)}</div>
              </div>
              <StatusBadge s={t.status} />
            </button>
            {open === t.id && <div className="mt-4 border-t border-border pt-4"><TicketThread ticketId={t.id} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

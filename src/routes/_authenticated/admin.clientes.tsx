import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR, errMsg } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/admin/clientes")({ component: Customers });

function Customers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const [p, w, o] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("wallets").select("user_id, balance"),
        supabase.from("orders").select("user_id, total, status"),
      ]);
      const wm = new Map((w.data ?? []).map((x) => [x.user_id, Number(x.balance)]));
      return (p.data ?? []).map((c) => {
        const mine = (o.data ?? []).filter((x) => x.user_id === c.id);
        const paid = mine.filter((x) => ["pago", "entregue"].includes(x.status));
        return { ...c, balance: wm.get(c.id) ?? 0, orders: mine.length, purchases: paid.length, spent: paid.reduce((s, x) => s + Number(x.total), 0) };
      });
    },
  });
  const list = data.filter((c) => `${c.full_name} ${c.email}`.toLowerCase().includes(q.toLowerCase()));

  const adjust = async (id: string) => {
    const amount = prompt("Valor do ajuste (use negativo para debitar), ex.: 50 ou -20");
    if (!amount) return;
    const note = prompt("Motivo do ajuste (obrigatório)");
    if (!note) return;
    const { error } = await supabase.rpc("admin_adjust_wallet", { _user: id, _amount: Number(amount.replace(",", ".")), _note: note });
    if (error) return toast.error(errMsg(error));
    toast.success("Saldo ajustado");
    qc.invalidateQueries();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Clientes ({data.length})</h1>
        <div className="flex gap-2">
          <Input placeholder="Nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} className="w-60" />
          <Button variant="glass" onClick={() => downloadCSV("clientes.csv", list.map(({ full_name, email, created_at, purchases, spent, balance, status }) => ({ full_name, email, created_at, purchases, spent, balance, status })))}>CSV</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Cliente</th><th className="p-3">Cadastro</th><th className="p-3">Pedidos</th><th className="p-3">Compras</th><th className="p-3">Valor gasto</th><th className="p-3">Saldo</th><th className="p-3">Status</th><th /></tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3">{c.full_name ?? "—"}<div className="text-xs text-muted-foreground">{c.email}</div></td>
                <td className="p-3 text-muted-foreground">{dateBR(c.created_at)}</td>
                <td className="p-3">{c.orders}</td>
                <td className="p-3">{c.purchases}</td>
                <td className="p-3">{brl(c.spent)}</td>
                <td className="p-3">{brl(c.balance)}</td>
                <td className="p-3 capitalize">{c.status}</td>
                <td className="p-3"><Button size="sm" variant="glass" onClick={() => adjust(c.id)}>Ajustar saldo</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

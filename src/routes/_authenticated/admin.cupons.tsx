import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR, errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/cupons")({ component: Coupons });

const empty = {
  code: "",
  discount_type: "percentual",
  value: "",
  min_total: "",
  max_uses: "",
  per_user_limit: "",
  expires_at: "",
};

function Coupons() {
  const qc = useQueryClient();
  const [f, setF] = useState(empty);
  const { data = [] } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () =>
      (await supabase.from("coupons").select("*").order("created_at", { ascending: false })).data ??
      [],
  });
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("coupons").insert({
      code: f.code.trim().toUpperCase(),
      discount_type: f.discount_type,
      value: Number(f.value),
      min_total: Number(f.min_total || 0),
      max_uses: f.max_uses ? Number(f.max_uses) : null,
      per_user_limit: f.per_user_limit ? Number(f.per_user_limit) : null,
      expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null,
    });
    if (error) return toast.error(errMsg(error));
    toast.success("Cupom criado");
    setF(empty);
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
  };
  const toggle = async (id: string, active: boolean) => {
    await supabase.from("coupons").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
  };
  const L = (l: string, el: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label>{l}</Label>
      {el}
    </div>
  );
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cupons</h1>
      <form
        onSubmit={create}
        className="grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-4"
      >
        {L(
          "Código",
          <Input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />,
        )}
        {L(
          "Tipo",
          <select
            value={f.discount_type}
            onChange={(e) => setF({ ...f, discount_type: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="percentual">Percentual (%)</option>
            <option value="fixo">Fixo (R$)</option>
          </select>,
        )}
        {L(
          "Valor",
          <Input
            required
            type="number"
            step="0.01"
            min="0.01"
            value={f.value}
            onChange={(e) => setF({ ...f, value: e.target.value })}
          />,
        )}
        {L(
          "Compra mínima (R$)",
          <Input
            type="number"
            step="0.01"
            value={f.min_total}
            onChange={(e) => setF({ ...f, min_total: e.target.value })}
          />,
        )}
        {L(
          "Máx. utilizações",
          <Input
            type="number"
            value={f.max_uses}
            onChange={(e) => setF({ ...f, max_uses: e.target.value })}
          />,
        )}
        {L(
          "Limite por cliente",
          <Input
            type="number"
            value={f.per_user_limit}
            onChange={(e) => setF({ ...f, per_user_limit: e.target.value })}
          />,
        )}
        {L(
          "Validade",
          <Input
            type="datetime-local"
            value={f.expires_at}
            onChange={(e) => setF({ ...f, expires_at: e.target.value })}
          />,
        )}
        <div className="flex items-end">
          <Button variant="hero" className="w-full">
            Criar cupom
          </Button>
        </div>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Código</th>
              <th className="p-3">Desconto</th>
              <th className="p-3">Mínimo</th>
              <th className="p-3">Usos</th>
              <th className="p-3">Validade</th>
              <th className="p-3">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 font-mono font-semibold">{c.code}</td>
                <td className="p-3">
                  {c.discount_type === "percentual" ? `${c.value}%` : brl(c.value)}
                </td>
                <td className="p-3">{brl(c.min_total)}</td>
                <td className="p-3">
                  {c.used_count}
                  {c.max_uses ? `/${c.max_uses}` : ""}
                </td>
                <td className="p-3 text-muted-foreground">{dateBR(c.expires_at)}</td>
                <td className="p-3">
                  <Switch checked={c.active} onCheckedChange={(v) => toggle(c.id, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

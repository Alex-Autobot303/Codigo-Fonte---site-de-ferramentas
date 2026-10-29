import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/format";
import { settingsQuery } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({ component: StoreSettings });

const fields = [
  ["store_name", "Nome da loja"],
  ["support_email", "E-mail de suporte"],
  ["whatsapp", "WhatsApp (com DDI e DDD, ex.: 5511999999999)"],
  ["instagram", "Instagram"],
  ["company_info", "Dados comerciais (CNPJ, endereço)"],
] as const;

function StoreSettings() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery());
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setF(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? "")]))); }, [data]);
  const save = async () => {
    const { id: _id, updated_at: _u, ...rest } = f;
    const { error } = await supabase.from("store_settings").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast.error(errMsg(error));
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["store_settings"] });
  };
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Configurações da loja</h1>
      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
        {fields.map(([k, l]) => (
          <div key={k} className="space-y-1.5"><Label>{l}</Label><Input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
        ))}
      </div>
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-1.5"><Label>Termos de uso</Label><Textarea rows={6} value={f.terms ?? ""} onChange={(e) => setF({ ...f, terms: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Política de privacidade (LGPD)</Label><Textarea rows={6} value={f.privacy_policy ?? ""} onChange={(e) => setF({ ...f, privacy_policy: e.target.value })} /></div>
      </div>
      <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
        <b>Pagamentos:</b> a carteira digital já funciona. PIX e cartão via Mercado Pago serão ativados assim que as credenciais da sua conta Mercado Pago forem configuradas.
      </div>
      <Button variant="hero" onClick={save}>Salvar configurações</Button>
    </div>
  );
}

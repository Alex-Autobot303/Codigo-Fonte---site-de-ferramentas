import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conta/configuracoes")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  useEffect(() => {
    setName(data?.full_name ?? "");
    setPhone(data?.phone ?? "");
  }, [data]);

  const save = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, phone })
      .eq("id", user!.id);
    if (error) toast.error(errMsg(error));
    else toast.success("Dados salvos");
  };
  const changePw = async () => {
    const { error } = await supabase.auth.updateUser({
      password: pw,
      current_password: cur,
    } as never);
    if (error) toast.error(errMsg(error));
    else {
      toast.success("Senha alterada");
      setPw("");
      setCur("");
    }
  };
  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button variant="hero" onClick={save}>
          Salvar
        </Button>
      </div>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Alterar senha</h2>
        <Input
          type="password"
          placeholder="Senha atual"
          value={cur}
          onChange={(e) => setCur(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Nova senha (mín. 8)"
          minLength={8}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <Button variant="glass" onClick={changePw} disabled={pw.length < 8}>
          Alterar senha
        </Button>
      </div>
    </div>
  );
}

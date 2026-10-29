import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — NexaTools" },
      { name: "description", content: "Defina uma nova senha." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Senha atualizada!");
    navigate({ to: "/conta" });
  };
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <form
        onSubmit={submit}
        className="space-y-4 rounded-3xl border border-border bg-card-grad p-8"
      >
        <h1 className="text-2xl font-bold">Definir nova senha</h1>
        <Input
          type="password"
          minLength={8}
          required
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Nova senha (mín. 8 caracteres)"
        />
        <Button variant="hero" className="w-full" disabled={busy}>
          Salvar
        </Button>
      </form>
    </div>
  );
}

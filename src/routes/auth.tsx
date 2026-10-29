import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — NexaTools" },
      { name: "description", content: "Acesse sua conta para comprar e acompanhar pedidos." },
      { property: "og:title", content: "Entrar — NexaTools" },
      { property: "og:description", content: "Acesse sua conta NexaTools." },
    ],
  }),
  component: AuthPage,
});

const safe = (r?: string) => (r && r.startsWith("/") && !r.startsWith("//") ? r : "/conta");

function AuthPage() {
  const { redirect } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: safe(redirect) });
  }, [user, redirect, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        if (!accept) throw new Error("Aceite os termos de uso e a política de privacidade");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de recuperação para o seu e-mail.");
        setMode("login");
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-glow" />
      <div className="rounded-3xl border border-border bg-card-grad p-8 shadow-glow">
        <h1 className="text-2xl font-bold">
          {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
        </h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="pw">Senha</Label>
              <Input
                id="pw"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          {mode === "signup" && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Li e aceito os{" "}
                <a href="/termos" className="text-primary">
                  Termos de uso
                </a>{" "}
                e a{" "}
                <a href="/privacidade" className="text-primary">
                  Política de privacidade
                </a>
                .
              </span>
            </label>
          )}
          <Button variant="hero" type="submit" className="w-full" size="lg" disabled={busy}>
            {busy
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar conta"
                  : "Enviar link"}
          </Button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              <button onClick={() => setMode("signup")} className="hover:text-primary">
                Não tem conta? <span className="text-primary">Criar conta</span>
              </button>
              <button onClick={() => setMode("forgot")} className="hover:text-primary">
                Esqueci minha senha
              </button>
            </>
          ) : (
            <button onClick={() => setMode("login")} className="hover:text-primary">
              Já tenho conta — entrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

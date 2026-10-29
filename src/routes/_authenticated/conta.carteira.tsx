import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { brl, dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conta/carteira")({ component: WalletPage });

const kindLabel: Record<string, string> = { recarga: "Recarga", compra: "Compra", reembolso: "Reembolso", ajuste: "Ajuste" };

function WalletPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["wallet-page", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [w, t] = await Promise.all([
        supabase.from("wallets").select("balance").maybeSingle(),
        supabase.from("wallet_transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(200),
      ]);
      return { balance: Number(w.data?.balance ?? 0), tx: t.data ?? [] };
    },
  });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Minha carteira</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-primary/40 bg-card-grad p-6 shadow-glow">
          <div className="text-sm text-muted-foreground">Saldo disponível</div>
          <div className="mt-1 font-display text-4xl font-bold">{brl(data?.balance)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 font-semibold"><QrCode className="h-5 w-5 text-primary" /> Recarregar via PIX</div>
          <p className="mt-2 text-sm text-muted-foreground">
            A recarga por PIX ficará disponível assim que a loja conectar o Mercado Pago. Enquanto isso, fale com o suporte para recargas manuais.
          </p>
        </div>
      </div>
      <h2 className="mb-3 mt-8 font-semibold">Movimentações</h2>
      <div className="overflow-hidden rounded-2xl border border-border">
        {(data?.tx ?? []).length === 0 ? <p className="p-5 text-sm text-muted-foreground">Nenhuma movimentação ainda.</p> : (
          <table className="w-full text-sm">
            <tbody>
              {data!.tx.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">{dateBR(t.created_at)}</td>
                  <td className="p-3">{kindLabel[t.kind] ?? t.kind}<div className="text-xs text-muted-foreground">{t.description}</div></td>
                  <td className={`p-3 text-right font-semibold ${Number(t.amount) >= 0 ? "text-success" : "text-destructive"}`}>{brl(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

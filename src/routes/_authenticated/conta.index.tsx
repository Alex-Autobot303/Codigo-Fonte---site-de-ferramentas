import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conta/")({ component: Overview });

function Overview() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["overview", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [w, o, d, t] = await Promise.all([
        supabase.from("wallets").select("balance").maybeSingle(),
        supabase.from("orders").select("id, total, status").eq("user_id", user!.id),
        supabase.from("deliveries").select("id").eq("user_id", user!.id).eq("status", "entregue"),
        supabase
          .from("support_tickets")
          .select("id")
          .eq("user_id", user!.id)
          .neq("status", "fechado"),
      ]);
      return {
        balance: Number(w.data?.balance ?? 0),
        orders: o.data?.length ?? 0,
        spent: (o.data ?? [])
          .filter((x) => ["pago", "entregue"].includes(x.status))
          .reduce((s, x) => s + Number(x.total), 0),
        deliveries: d.data?.length ?? 0,
        tickets: t.data?.length ?? 0,
      };
    },
  });
  const cards = [
    { l: "Saldo da carteira", v: brl(data?.balance), to: "/conta/carteira" },
    { l: "Pedidos", v: data?.orders ?? 0, to: "/conta/pedidos" },
    { l: "Total investido", v: brl(data?.spent), to: "/conta/pedidos" },
    { l: "Produtos entregues", v: data?.deliveries ?? 0, to: "/conta/entregas" },
    { l: "Chamados abertos", v: data?.tickets ?? 0, to: "/conta/suporte" },
  ] as const;
  return (
    <div>
      <h1 className="text-2xl font-bold">
        Olá{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}!
      </h1>
      <p className="text-sm text-muted-foreground">{user?.email}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.l}
            to={c.to}
            className="rounded-2xl border border-border bg-card-grad p-5 transition hover:border-primary/60"
          >
            <div className="text-sm text-muted-foreground">{c.l}</div>
            <div className="mt-1 font-display text-2xl font-bold">{c.v}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

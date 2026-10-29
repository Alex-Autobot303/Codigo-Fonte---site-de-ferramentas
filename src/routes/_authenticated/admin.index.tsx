import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Dashboard });

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["admin-dash"],
    queryFn: async () => {
      const [o, p, c, items, tx] = await Promise.all([
        supabase.from("orders").select("id, number, total, status, created_at, paid_at, payment_method, user_id").order("created_at", { ascending: false }).limit(1000),
        supabase.from("products").select("id, name, sales_count, active"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("order_items").select("product_name, quantity, unit_price, orders!inner(status)").in("orders.status", ["pago", "entregue"]),
        supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(1000),
      ]);
      return { orders: o.data ?? [], products: p.data ?? [], customers: c.count ?? 0, items: items.data ?? [], tx: tx.data ?? [] };
    },
  });
  const orders = data?.orders ?? [];
  const paid = orders.filter((x) => ["pago", "entregue"].includes(x.status));
  const sum = (a: typeof orders) => a.reduce((s, x) => s + Number(x.total), 0);
  const today = new Date().toDateString();
  const month = new Date().toISOString().slice(0, 7);
  const revenue = sum(paid);
  const stats = [
    { l: "Faturamento total", v: brl(revenue) },
    { l: "Faturamento hoje", v: brl(sum(paid.filter((x) => new Date(x.paid_at ?? x.created_at).toDateString() === today))) },
    { l: "Faturamento do mês", v: brl(sum(paid.filter((x) => (x.paid_at ?? x.created_at).startsWith(month)))) },
    { l: "Total de pedidos", v: orders.length },
    { l: "Pedidos pagos", v: paid.length },
    { l: "Pendentes", v: orders.filter((x) => x.status === "pendente").length },
    { l: "Cancelados", v: orders.filter((x) => ["cancelado", "reembolsado"].includes(x.status)).length },
    { l: "Clientes", v: data?.customers ?? 0 },
    { l: "Produtos ativos", v: (data?.products ?? []).filter((p) => p.active).length },
    { l: "Ticket médio", v: brl(paid.length ? revenue / paid.length : 0) },
  ];

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 29 + i);
    const key = d.toISOString().slice(0, 10);
    return { dia: key.slice(5), valor: sum(paid.filter((x) => (x.paid_at ?? x.created_at).slice(0, 10) === key)) };
  });
  const top = [...(data?.products ?? [])].sort((a, b) => b.sales_count - a.sales_count).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="glass" size="sm" onClick={() => downloadCSV("vendas.csv", paid.map((o) => ({ pedido: o.number, total: o.total, metodo: o.payment_method, status: o.status, pago_em: o.paid_at })))}><Download /> Vendas CSV</Button>
          <Button variant="glass" size="sm" onClick={() => downloadCSV("carteira.csv", (data?.tx ?? []).map((t) => ({ data: t.created_at, usuario: t.user_id, tipo: t.kind, valor: t.amount, descricao: t.description })))}><Download /> Extrato carteira CSV</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <div key={s.l} className="rounded-2xl border border-border bg-card-grad p-4">
            <div className="text-xs text-muted-foreground">{s.l}</div>
            <div className="mt-1 font-display text-xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 xl:col-span-2">
          <h2 className="mb-4 font-semibold">Vendas — últimos 30 dias</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={days}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: number) => brl(v)} />
                <Area dataKey="valor" stroke="var(--chart-1)" fill="url(#g)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Mais vendidos</h2>
          <ol className="space-y-2 text-sm">
            {top.map((p, i) => <li key={p.id} className="flex justify-between"><span>{i + 1}. {p.name}</span><span className="text-muted-foreground">{p.sales_count}</span></li>)}
          </ol>
          <p className="mt-6 text-xs text-muted-foreground">Lucro estimado e controle de despesas dependem do cadastro de custos (próxima etapa).</p>
        </div>
      </div>
    </div>
  );
}

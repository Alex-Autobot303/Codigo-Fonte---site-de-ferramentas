import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CreditCard, QrCode, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { brl, errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout — NexaTools" }, { name: "description", content: "Finalize seu pedido." }] }),
  component: Checkout,
});

type Method = "carteira" | "pix" | "cartao";

function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [coupon, setCoupon] = useState("");
  const [method, setMethod] = useState<Method>("carteira");
  const [busy, setBusy] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallets").select("balance").maybeSingle()).data,
  });
  const balance = Number(wallet?.balance ?? 0);

  if (!items.length)
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Nada para finalizar</h1>
        <Button variant="hero" className="mt-6" asChild><Link to="/produtos">Ver produtos</Link></Button>
      </div>
    );

  const submit = async () => {
    setBusy(true);
    try {
      const { data: orderId, error } = await supabase.rpc("create_order", {
        _items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        _coupon: coupon.trim() || undefined,
      });
      if (error) throw error;
      if (method === "carteira") {
        const { error: payErr } = await supabase.rpc("pay_order_with_wallet", { _order: orderId as string });
        if (payErr) {
          clear();
          toast.error(`Pedido criado, mas não pago: ${payErr.message}`);
          return navigate({ to: "/conta/pedidos" });
        }
        toast.success("Pagamento aprovado! Confira sua entrega.");
      } else {
        toast.info("Pedido criado. Ele fica aguardando pagamento até a confirmação do provedor.");
      }
      clear();
      qc.invalidateQueries();
      navigate({ to: "/conta/pedidos" });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const opt = (m: Method, Icon: typeof Wallet, title: string, desc: string, disabled = false) => (
    <button type="button" disabled={disabled} onClick={() => setMethod(m)}
      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition disabled:opacity-50 ${method === m ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card hover:border-primary/50"}`}>
      <Icon className="mt-0.5 h-5 w-5 text-primary" />
      <div><div className="font-semibold">{title}</div><div className="text-sm text-muted-foreground">{desc}</div></div>
    </button>
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <section className="space-y-3">
          <h2 className="font-semibold">Forma de pagamento</h2>
          {opt("carteira", Wallet, `Saldo da carteira (${brl(balance)})`, balance >= subtotal ? "Pagamento instantâneo com seu saldo." : "Saldo pode ser insuficiente — recarregue em Minha carteira.")}
          {opt("pix", QrCode, "PIX via Mercado Pago", "Em configuração — disponível assim que a loja conectar o Mercado Pago.", true)}
          {opt("cartao", CreditCard, "Cartão de crédito via Mercado Pago", "Em configuração — disponível assim que a loja conectar o Mercado Pago.", true)}
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold">Cupom de desconto</h2>
          <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Digite seu cupom (validado ao confirmar)" className="max-w-sm" />
        </section>
      </div>
      <aside className="h-fit rounded-2xl border border-border bg-card-grad p-6">
        <h2 className="text-lg font-bold">Resumo do pedido</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {items.map((i) => (
            <li key={i.product_id} className="flex justify-between gap-3"><span className="text-muted-foreground">{i.quantity}× {i.name}</span><span>{brl(i.unit_price * i.quantity)}</span></li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-border pt-4 font-semibold"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">Desconto do cupom e total final são calculados no servidor.</p>
        <Button variant="hero" size="lg" className="mt-6 w-full" disabled={busy} onClick={submit}>
          {busy ? "Processando..." : "Confirmar pedido"}
        </Button>
      </aside>
    </div>
  );
}

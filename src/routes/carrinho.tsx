import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — NexaTools" },
      { name: "description", content: "Revise os produtos do seu carrinho." },
      { property: "og:title", content: "Carrinho — NexaTools" },
      { property: "og:description", content: "Seu carrinho de compras." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, setQty, remove, subtotal } = useCart();
  if (!items.length)
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <ShoppingBag className="mx-auto h-14 w-14 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Seu carrinho está vazio</h1>
        <Button variant="hero" className="mt-6" asChild><Link to="/produtos">Explorar produtos</Link></Button>
      </div>
    );
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-6 text-3xl font-bold">Carrinho</h1>
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.product_id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3">
              <img src={i.image_url ?? ""} alt={i.name} className="h-20 w-24 rounded-xl object-cover" loading="lazy" />
              <div className="min-w-0 flex-1">
                <Link to="/produto/$slug" params={{ slug: i.slug }} className="font-semibold hover:text-primary">{i.name}</Link>
                <div className="text-sm text-muted-foreground">{brl(i.unit_price)}</div>
              </div>
              <div className="flex items-center rounded-xl border border-border">
                <button className="p-2" onClick={() => setQty(i.product_id, i.quantity - 1)} aria-label="Diminuir"><Minus className="h-4 w-4" /></button>
                <span className="w-6 text-center tabular-nums">{i.quantity}</span>
                <button className="p-2" onClick={() => setQty(i.product_id, i.quantity + 1)} aria-label="Aumentar"><Plus className="h-4 w-4" /></button>
              </div>
              <div className="hidden w-24 text-right font-semibold sm:block">{brl(i.unit_price * i.quantity)}</div>
              <button onClick={() => remove(i.product_id)} className="p-2 text-muted-foreground hover:text-destructive" aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <Link to="/produtos" className="mt-6 inline-block text-sm text-primary hover:underline">← Continuar comprando</Link>
      </div>
      <aside className="h-fit rounded-2xl border border-border bg-card-grad p-6 lg:sticky lg:top-32">
        <h2 className="text-lg font-bold">Resumo</h2>
        <div className="mt-4 flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{brl(subtotal)}</span></div>
        <p className="mt-2 text-xs text-muted-foreground">Cupons são aplicados no checkout. Preços finais são confirmados pelo servidor.</p>
        <Button variant="hero" size="lg" className="mt-6 w-full" asChild><Link to="/checkout">Finalizar pedido</Link></Button>
      </aside>
    </div>
  );
}

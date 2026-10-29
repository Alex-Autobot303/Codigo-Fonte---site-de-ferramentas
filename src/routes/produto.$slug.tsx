import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Heart, Minus, Plus, Share2, ShoppingCart, Truck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/store/Countdown";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { brl, errMsg } from "@/lib/format";
import { finalPrice, PRODUCT_COLS, type Product } from "@/lib/catalog";

export const Route = createFileRoute("/produto/$slug")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ");
    return {
      meta: [
        { title: `${name} — NexaTools` },
        { name: "description", content: `Detalhes, preço e entrega de ${name}.` },
        { property: "og:title", content: `${name} — NexaTools` },
        { property: "og:description", content: `Conheça ${name} na NexaTools.` },
        { property: "og:type", content: "product" },
      ],
    };
  },
  component: ProductPage,
});

const deliveryLabel = { licenca: "Chave de licença automática", arquivo: "Download protegido", manual: "Entrega manual pela equipe" };

function ProductPage() {
  const { slug } = Route.useParams();
  const { add } = useCart();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);

  const { data: p, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(PRODUCT_COLS).eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data as unknown as Product | null;
    },
  });
  const { data: fav } = useQuery({
    queryKey: ["fav", p?.id, user?.id],
    enabled: !!p && !!user,
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("product_id").eq("product_id", p!.id).maybeSingle();
      return !!data;
    },
  });

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-16 text-muted-foreground">Carregando...</div>;
  if (!p) return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-2xl font-bold">Produto não encontrado</h1>
      <Link to="/produtos" className="mt-4 inline-block text-primary">Ver catálogo</Link>
    </div>
  );

  const out = p.stock !== null && p.stock <= 0;
  const item = { product_id: p.id, slug: p.slug, name: p.name, image_url: p.image_url, unit_price: finalPrice(p) };

  const toggleFav = async () => {
    if (!user) return navigate({ to: "/auth", search: { redirect: `/produto/${slug}` } });
    try {
      if (fav) await supabase.from("favorites").delete().eq("product_id", p.id).throwOnError();
      else await supabase.from("favorites").insert({ user_id: user.id, product_id: p.id }).throwOnError();
      qc.invalidateQueries({ queryKey: ["fav"] });
    } catch (e) { toast.error(errMsg(e)); }
  };
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: p.name, url }).catch(() => {});
    else { await navigator.clipboard.writeText(url); toast.success("Link copiado"); }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/produtos" className="hover:text-primary">Produtos</Link>
        {p.categories && <> / <Link to="/produtos" search={{ categoria: p.categories.slug }} className="hover:text-primary">{p.categories.name}</Link></>}
      </nav>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-glow">
          <img src={p.image_url ?? ""} alt={p.name} width={1024} height={768} className="aspect-[4/3] w-full object-cover" />
        </div>
        <div className="flex flex-col gap-5">
          <span className="text-sm font-medium uppercase tracking-wider text-primary">{p.categories?.name}</span>
          <h1 className="text-4xl font-extrabold">{p.name}</h1>
          <p className="text-muted-foreground">{p.short_description}</p>
          <div className="rounded-2xl border border-border bg-card-grad p-5">
            {p.promo_price && <div className="text-sm text-muted-foreground line-through">{brl(p.price)}</div>}
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-4xl font-bold">{brl(finalPrice(p))}</span>
            </div>
            {p.promo_price && p.promo_ends_at && (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">Oferta termina em <Countdown to={p.promo_ends_at} /></div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-xl border border-border">
                <button className="p-2.5" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center tabular-nums">{qty}</span>
                <button className="p-2.5" onClick={() => setQty((q) => Math.min(50, q + 1))} aria-label="Aumentar"><Plus className="h-4 w-4" /></button>
              </div>
              <Button variant="hero" size="lg" disabled={out} onClick={() => { add(item, qty); navigate({ to: "/carrinho" }); }}>
                <Zap /> {out ? "Esgotado" : "Comprar agora"}
              </Button>
              <Button variant="glass" size="lg" disabled={out} onClick={() => { add(item, qty); toast.success("Adicionado ao carrinho"); }}>
                <ShoppingCart /> Adicionar ao carrinho
              </Button>
            </div>
            <div className="mt-4 flex gap-4 text-sm">
              <button onClick={toggleFav} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
                <Heart className={`h-4 w-4 ${fav ? "fill-violet text-violet" : ""}`} /> {fav ? "Favoritado" : "Favoritar"}
              </button>
              <button onClick={share} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary"><Share2 className="h-4 w-4" /> Compartilhar</button>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
            <Truck className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">{deliveryLabel[p.delivery_type]}</div>
              <div className="text-muted-foreground">{p.delivery_info}</div>
              {p.stock !== null && <div className="mt-1 text-muted-foreground">Estoque: {p.stock}</div>}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-14 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-xl font-bold">Descrição</h2>
          <p className="whitespace-pre-line text-muted-foreground">{p.description}</p>
          <h2 className="mb-3 mt-8 text-xl font-bold">Funcionalidades</h2>
          <ul className="space-y-2">{p.features.map((f) => <li key={f} className="flex gap-2 text-muted-foreground"><Check className="h-5 w-5 shrink-0 text-primary" />{f}</li>)}</ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-3 text-xl font-bold">Benefícios</h2>
          <ul className="space-y-2">{p.benefits.map((b) => <li key={b} className="flex gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 shrink-0 text-violet" />{b}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}

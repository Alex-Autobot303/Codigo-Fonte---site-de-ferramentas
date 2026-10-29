import { Link } from "@tanstack/react-router";
import { ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { brl } from "@/lib/format";
import { finalPrice, type Product } from "@/lib/catalog";

export function ProductCard({ p }: { p: Product }) {
  const { add } = useCart();
  const out = p.stock !== null && p.stock <= 0;
  const addToCart = () => {
    add({
      product_id: p.id,
      slug: p.slug,
      name: p.name,
      image_url: p.image_url,
      unit_price: finalPrice(p),
    });
    toast.success(`${p.name} adicionado ao carrinho`);
  };
  const off = p.promo_price ? Math.round((1 - Number(p.promo_price) / Number(p.price)) * 100) : 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card-grad transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-glow">
      <Link
        to="/produto/$slug"
        params={{ slug: p.slug }}
        className="relative block aspect-[4/3] overflow-hidden"
      >
        <img
          src={p.image_url ?? "/images/cat-ferramentas-digitais.jpg"}
          alt={p.name}
          loading="lazy"
          width={1024}
          height={768}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {off > 0 && (
            <span className="rounded-full bg-violet px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
              -{off}%
            </span>
          )}
          {p.is_new && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
              Novo
            </span>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs font-medium uppercase tracking-wider text-primary">
          {p.categories?.name}
        </span>
        <Link
          to="/produto/$slug"
          params={{ slug: p.slug }}
          className="font-display text-lg font-semibold leading-tight hover:text-primary"
        >
          {p.name}
        </Link>
        <p className="line-clamp-2 text-sm text-muted-foreground">{p.short_description}</p>
        <div className="mt-auto pt-2">
          {p.promo_price && (
            <div className="text-xs text-muted-foreground line-through">{brl(p.price)}</div>
          )}
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold">{brl(finalPrice(p))}</span>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <Button variant="hero" size="sm" disabled={out} asChild={!out}>
            {out ? (
              <span>Esgotado</span>
            ) : (
              <Link to="/produto/$slug" params={{ slug: p.slug }}>
                <Zap /> Comprar
              </Link>
            )}
          </Button>
          <Button
            variant="glass"
            size="icon"
            disabled={out}
            onClick={addToCart}
            aria-label="Adicionar ao carrinho"
          >
            <ShoppingCart />
          </Button>
        </div>
      </div>
    </div>
  );
}

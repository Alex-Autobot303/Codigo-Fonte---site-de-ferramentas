import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Headphones,
  LayoutGrid,
  Menu,
  Package,
  Search,
  Shield,
  ShoppingCart,
  User,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { categoriesQuery, settingsQuery } from "@/lib/catalog";

export function Logo({ name }: { name?: string }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand font-display text-lg font-bold text-primary-foreground shadow-glow">
        {(name ?? "N").charAt(0)}
      </span>
      <span className="font-display text-lg font-bold">{name ?? "NexaTools"}</span>
    </Link>
  );
}

export function SiteHeader() {
  const { count } = useCart();
  const { user, isAdmin } = useAuth();
  const { data: cats } = useQuery(categoriesQuery());
  const { data: settings } = useQuery(settingsQuery());
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/produtos", search: { q: q || undefined } });
  };

  const navLinks = (
    <>
      <Link to="/conta" className="flex items-center gap-2 hover:text-primary">
        <User className="h-4 w-4" />
        {user ? "Minha conta" : "Entrar"}
      </Link>
      <Link to="/conta/pedidos" className="flex items-center gap-2 hover:text-primary">
        <Package className="h-4 w-4" />
        Meus pedidos
      </Link>
      <Link to="/conta/suporte" className="flex items-center gap-2 hover:text-primary">
        <Headphones className="h-4 w-4" />
        Suporte
      </Link>
      {isAdmin && (
        <Link to="/admin" className="flex items-center gap-2 text-violet hover:text-primary">
          <Shield className="h-4 w-4" />
          Admin
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Sheet>
          <SheetTrigger className="lg:hidden" aria-label="Menu">
            <Menu className="h-6 w-6" />
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col gap-5 bg-background">
            <SheetTitle>
              <Logo name={settings?.store_name} />
            </SheetTitle>
            <div className="flex flex-col gap-4 text-sm">{navLinks}</div>
            <div className="border-t border-border pt-4 text-xs uppercase tracking-wider text-muted-foreground">
              Categorias
            </div>
            <div className="flex flex-col gap-3 text-sm">
              {cats?.map((c) => (
                <Link
                  key={c.id}
                  to="/produtos"
                  search={{ categoria: c.slug }}
                  className="hover:text-primary"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
        <Logo name={settings?.store_name} />
        <form onSubmit={submit} className="relative mx-auto hidden w-full max-w-xl md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar ferramentas, automações, IA..."
            className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:shadow-glow"
          />
        </form>
        <nav className="hidden items-center gap-5 text-sm lg:flex">{navLinks}</nav>
        <Link
          to="/carrinho"
          className="relative ml-auto grid h-11 w-11 place-items-center rounded-xl border border-border bg-card hover:border-primary md:ml-0"
          aria-label="Carrinho"
        >
          <ShoppingCart className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-violet px-1 text-[11px] font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </Link>
      </div>
      <div className="hidden border-t border-border/60 md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2 text-sm text-muted-foreground">
          <Link
            to="/produtos"
            className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary"
          >
            <LayoutGrid className="h-4 w-4" />
            Todos
          </Link>
          {cats?.map((c) => (
            <Link
              key={c.id}
              to="/produtos"
              search={{ categoria: c.slug }}
              className="whitespace-nowrap hover:text-primary"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
      <form onSubmit={submit} className="relative px-4 pb-3 md:hidden">
        <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-[85%] text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar produtos..."
          className="h-10 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-sm outline-none focus:border-primary"
        />
      </form>
    </header>
  );
}

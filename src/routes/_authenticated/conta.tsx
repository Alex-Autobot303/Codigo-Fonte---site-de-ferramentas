import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  Download,
  Headphones,
  Heart,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — NexaTools" },
      { name: "description", content: "Painel do cliente." },
    ],
  }),
  component: AccountLayout,
});

const links = [
  { to: "/conta", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/revendedor", label: "Área do Revendedor (B2B)", icon: KeyRound },
  { to: "/conta/pedidos", label: "Meus pedidos", icon: Package },
  { to: "/conta/carteira", label: "Minha carteira", icon: Wallet },
  { to: "/conta/entregas", label: "Downloads e licenças", icon: Download },
  { to: "/conta/favoritos", label: "Favoritos", icon: Heart },
  { to: "/conta/suporte", label: "Suporte", icon: Headphones },
  { to: "/conta/configuracoes", label: "Configurações", icon: Settings },
] as const;

function AccountLayout() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[240px_1fr]">
      <aside className="flex gap-1 overflow-x-auto lg:flex-col">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeOptions={{ exact: "exact" in l }}
            className="flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-card hover:text-foreground"
            activeProps={{ className: "bg-primary/15 !text-primary" }}
          >
            <l.icon className="h-4 w-4" /> {l.label}
          </Link>
        ))}
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/" });
          }}
          className="flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </aside>
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}

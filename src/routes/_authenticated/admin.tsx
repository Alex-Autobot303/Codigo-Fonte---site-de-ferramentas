import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  BarChart3,
  Headphones,
  KeyRound,
  Package,
  Settings,
  ShoppingBag,
  Tag,
  Truck,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel administrativo — NexaTools" },
      { name: "description", content: "Gestão da loja." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const links = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true },
  { to: "/admin/revendedores", label: "🔌 API B2B Revenda", icon: KeyRound },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/admin/entregas", label: "Entregas", icon: Truck },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/cupons", label: "Cupons", icon: Tag },
  { to: "/admin/suporte", label: "Suporte", icon: Headphones },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
] as const;

function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="p-10 text-muted-foreground">Carregando...</div>;
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Acesso restrito</h1>
        <p className="mt-2 text-muted-foreground">Esta área é exclusiva para administradores.</p>
      </div>
    );
  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 lg:grid-cols-[220px_1fr]">
      <aside className="flex gap-1 overflow-x-auto lg:flex-col">
        <div className="mb-2 hidden px-3 text-xs font-semibold uppercase tracking-wider text-violet lg:block">
          Administração
        </div>
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeOptions={{ exact: "exact" in l }}
            className="flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-card hover:text-foreground"
            activeProps={{ className: "bg-violet/15 !text-foreground" }}
          >
            <l.icon className="h-4 w-4" /> {l.label}
          </Link>
        ))}
      </aside>
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}

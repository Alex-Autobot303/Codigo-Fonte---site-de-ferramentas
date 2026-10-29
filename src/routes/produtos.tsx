import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ProductCard } from "@/components/store/ProductCard";
import { categoriesQuery, finalPrice, productsQuery } from "@/lib/catalog";

const search = z.object({
  q: z.string().optional(),
  categoria: z.string().optional(),
  ordem: z.enum(["nome", "menor", "maior", "vendidos"]).optional(),
});

export const Route = createFileRoute("/produtos")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Catálogo de produtos — NexaTools" },
      { name: "description", content: "Explore automações, ferramentas de prospecção, IA e marketing digital." },
      { property: "og:title", content: "Catálogo de produtos — NexaTools" },
      { property: "og:description", content: "Todas as ferramentas digitais em um só lugar." },
    ],
  }),
  component: Catalog,
});

function Catalog() {
  const { q, categoria, ordem = "nome" } = Route.useSearch();
  const { data: products = [], isLoading } = useQuery(productsQuery());
  const { data: cats = [] } = useQuery(categoriesQuery());
  const navigate = useNavigate({ from: "/produtos" });
  const cat = cats.find((c) => c.slug === categoria);

  let list = products.filter((p) => (!cat || p.category_id === cat.id) && (!q || `${p.name} ${p.short_description}`.toLowerCase().includes(q.toLowerCase())));
  list = [...list].sort((a, b) =>
    ordem === "menor" ? finalPrice(a) - finalPrice(b) : ordem === "maior" ? finalPrice(b) - finalPrice(a) : ordem === "vendidos" ? b.sales_count - a.sales_count : a.name.localeCompare(b.name),
  );

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition ${active ? "border-primary bg-primary/15 text-primary" : "border-border hover:border-primary/50"}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold">{cat?.name ?? (q ? `Resultados para “${q}”` : "Todos os produtos")}</h1>
      {cat?.description && <p className="mt-1 text-muted-foreground">{cat.description}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link to="/produtos" search={{ q }} className={chip(!cat)}>Todos</Link>
        {cats.map((c) => (
          <Link key={c.id} to="/produtos" search={{ q, categoria: c.slug }} className={chip(cat?.id === c.id)}>{c.name}</Link>
        ))}
        <select
          value={ordem}
          onChange={(e) => navigate({ search: { q, categoria, ordem: e.target.value as "nome" } })}
          className="ml-auto h-9 rounded-lg border border-input bg-card px-3 text-sm"
        >
          <option value="nome">Nome</option>
          <option value="menor">Menor preço</option>
          <option value="maior">Maior preço</option>
          <option value="vendidos">Mais vendidos</option>
        </select>
      </div>
      {isLoading ? (
        <p className="mt-10 text-muted-foreground">Carregando...</p>
      ) : list.length === 0 ? (
        <p className="mt-10 text-muted-foreground">Nenhum produto encontrado.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}

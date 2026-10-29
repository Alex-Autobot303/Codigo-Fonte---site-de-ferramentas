import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ProductCard } from "@/components/store/ProductCard";
import { PRODUCT_COLS, type Product } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/conta/favoritos")({ component: Favs });

function Favs() {
  const { user } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ["favs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: f } = await supabase
        .from("favorites")
        .select("product_id")
        .eq("user_id", user!.id);
      const ids = (f ?? []).map((x) => x.product_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("products").select(PRODUCT_COLS).in("id", ids);
      return (data ?? []) as unknown as Product[];
    },
  });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Favoritos</h1>
      {data.length === 0 ? (
        <p className="text-muted-foreground">Você ainda não favoritou produtos.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

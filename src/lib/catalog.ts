import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_COLS =
  "id, slug, name, short_description, description, image_url, price, promo_price, benefits, features, delivery_info, delivery_type, stock, active, featured, bestseller, is_new, demo_price, promo_ends_at, sales_count, category_id, categories(slug, name)";

export type Product = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  image_url: string | null;
  price: number;
  promo_price: number | null;
  benefits: string[];
  features: string[];
  delivery_info: string | null;
  delivery_type: "licenca" | "arquivo" | "manual";
  stock: number | null;
  active: boolean;
  featured: boolean;
  bestseller: boolean;
  is_new: boolean;
  demo_price: boolean;
  promo_ends_at: string | null;
  sales_count: number;
  category_id: string | null;
  categories: { slug: string; name: string } | null;
};

export const productsQuery = () =>
  queryOptions({
    queryKey: ["products"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select(PRODUCT_COLS)
          .eq("active", true)
          .order("name");
        if (error) {
          console.warn("[catalog] products query warning:", error);
          return [];
        }
        return (data ?? []) as unknown as Product[];
      } catch (err) {
        console.warn("[catalog] products catch:", err);
        return [];
      }
    },
  });

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("categories").select("*").order("sort_order");
        if (error) {
          console.warn("[catalog] categories query warning:", error);
          return [];
        }
        return data ?? [];
      } catch (err) {
        console.warn("[catalog] categories catch:", err);
        return [];
      }
    },
  });

export const settingsQuery = () =>
  queryOptions({
    queryKey: ["store_settings"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("store_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle();
        if (error) {
          console.warn("[catalog] store_settings query warning:", error);
          return null;
        }
        return data;
      } catch (err) {
        console.warn("[catalog] store_settings catch:", err);
        return null;
      }
    },
  });

export const finalPrice = (p: Pick<Product, "price" | "promo_price">) =>
  Number(p.promo_price ?? p.price);

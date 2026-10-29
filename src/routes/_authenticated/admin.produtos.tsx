import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { brl, errMsg } from "@/lib/format";
import { categoriesQuery, PRODUCT_COLS, type Product } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  component: AdminProducts,
});

type Draft = Partial<Product> & { benefitsText?: string; featuresText?: string };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function AdminProducts() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Draft | null>(null);
  const { data: cats = [] } = useQuery(categoriesQuery());
  const { data = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () =>
      ((await supabase.from("products").select(PRODUCT_COLS).order("name")).data ??
        []) as unknown as Product[],
  });
  const list = data.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  const toggle = async (p: Product, field: "active" | "featured") => {
    const { error } = await supabase
      .from("products")
      .update(field === "active" ? { active: !p.active } : { featured: !p.featured })
      .eq("id", p.id);
    if (error) toast.error(errMsg(error));
    qc.invalidateQueries();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Produtos ({data.length})</h1>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56"
          />
          <Button
            variant="hero"
            onClick={() =>
              setEdit({
                price: 0,
                active: true,
                delivery_type: "manual",
                benefits: [],
                features: [],
                demo_price: true,
                image_url: "/images/cat-ferramentas-digitais.jpg",
              })
            }
          >
            <Plus /> Novo
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Produto</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Preço</th>
              <th className="p-3">Estoque</th>
              <th className="p-3">Entrega</th>
              <th className="p-3">Ativo</th>
              <th className="p-3">Destaque</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={p.image_url ?? ""}
                      alt=""
                      className="h-10 w-12 rounded-lg object-cover"
                    />
                    {p.name}
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{p.categories?.name}</td>
                <td className="p-3">
                  {p.promo_price ? (
                    <>
                      <s className="text-muted-foreground">{brl(p.price)}</s> {brl(p.promo_price)}
                    </>
                  ) : (
                    brl(p.price)
                  )}
                  {p.demo_price && <span className="ml-1 text-[10px] text-warning">demo</span>}
                </td>
                <td className="p-3">{p.stock ?? "∞"}</td>
                <td className="p-3 capitalize">{p.delivery_type}</td>
                <td className="p-3">
                  <Switch checked={p.active} onCheckedChange={() => toggle(p, "active")} />
                </td>
                <td className="p-3">
                  <Switch checked={p.featured} onCheckedChange={() => toggle(p, "featured")} />
                </td>
                <td className="p-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setEdit({
                        ...p,
                        benefitsText: p.benefits.join("\n"),
                        featuresText: p.features.join("\n"),
                      })
                    }
                  >
                    <Pencil />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <ProductDialog draft={edit} cats={cats} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ProductDialog({
  draft,
  cats,
  onClose,
}: {
  draft: Draft;
  cats: { id: string; name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>({
    benefitsText: (draft.benefits ?? []).join("\n"),
    featuresText: (draft.features ?? []).join("\n"),
    ...draft,
  });
  const [busy, setBusy] = useState(false);
  const [licenses, setLicenses] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const set = (k: keyof Draft, v: unknown) => setD((x) => ({ ...x, [k]: v }));

  const { data: licStats } = useQuery({
    queryKey: ["lic", draft.id],
    enabled: !!draft.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_licenses")
        .select("order_item_id")
        .eq("product_id", draft.id!);
      const { data: f } = await supabase
        .from("product_files")
        .select("file_url")
        .eq("product_id", draft.id!)
        .maybeSingle();
      setFileUrl(f?.file_url ?? "");
      return {
        total: data?.length ?? 0,
        free: (data ?? []).filter((x) => !x.order_item_id).length,
      };
    },
  });

  const uploadImage = async (file: File) => {
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) return toast.error(errMsg(error));
    const { data: signed, error: sErr } = await supabase.storage
      .from("product-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (sErr || !signed) return toast.error(errMsg(sErr));
    set("image_url", signed.signedUrl);
  };

  const save = async () => {
    if (!d.name) return toast.error("Informe o nome");
    setBusy(true);
    try {
      const row = {
        name: d.name,
        slug: d.slug || slugify(d.name),
        category_id: d.category_id ?? null,
        short_description: d.short_description ?? null,
        description: d.description ?? null,
        image_url: d.image_url ?? null,
        price: Number(d.price ?? 0),
        promo_price: d.promo_price ? Number(d.promo_price) : null,
        promo_ends_at: d.promo_ends_at || null,
        benefits: (d.benefitsText ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        features: (d.featuresText ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        delivery_info: d.delivery_info ?? null,
        delivery_type: d.delivery_type ?? "manual",
        stock:
          d.stock === null || d.stock === undefined || (d.stock as unknown) === ""
            ? null
            : Number(d.stock),
        active: d.active ?? true,
        featured: d.featured ?? false,
        bestseller: d.bestseller ?? false,
        is_new: d.is_new ?? false,
        demo_price: d.demo_price ?? false,
        updated_at: new Date().toISOString(),
      };
      let id = d.id;
      if (id) await supabase.from("products").update(row).eq("id", id).throwOnError();
      else
        id = (await supabase.from("products").insert(row).select("id").single().throwOnError())
          .data!.id;
      if (licenses.trim()) {
        const keys = [
          ...new Set(
            licenses
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ];
        const { error } = await supabase.from("product_licenses").upsert(
          keys.map((k) => ({ product_id: id!, license_key: k })),
          { onConflict: "product_id,license_key", ignoreDuplicates: true },
        );
        if (error) throw error;
      }
      if (fileUrl !== null) {
        if (fileUrl.trim())
          await supabase
            .from("product_files")
            .upsert({
              product_id: id!,
              file_url: fileUrl.trim(),
              updated_at: new Date().toISOString(),
            })
            .throwOnError();
        else await supabase.from("product_files").delete().eq("product_id", id!).throwOnError();
      }
      toast.success("Produto salvo");
      qc.invalidateQueries();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!d.id || !confirm("Excluir este produto? Prefira desativar para manter o histórico."))
      return;
    const { error } = await supabase.from("products").delete().eq("id", d.id);
    if (error) return toast.error(errMsg(error));
    qc.invalidateQueries();
    onClose();
  };

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{d.id ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          {F({
            label: "Nome",
            children: <Input value={d.name ?? ""} onChange={(e) => set("name", e.target.value)} />,
          })}
          {F({
            label: "URL amigável (slug)",
            children: (
              <Input
                value={d.slug ?? ""}
                placeholder="gerado automaticamente"
                onChange={(e) => set("slug", slugify(e.target.value))}
              />
            ),
          })}
          {F({
            label: "Categoria",
            children: (
              <select
                value={d.category_id ?? ""}
                onChange={(e) => set("category_id", e.target.value || null)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ),
          })}
          {F({
            label: "Estoque (vazio = ilimitado)",
            children: (
              <Input
                type="number"
                value={d.stock ?? ""}
                onChange={(e) => set("stock", e.target.value === "" ? null : e.target.value)}
              />
            ),
          })}
          {F({
            label: "Preço (R$)",
            children: (
              <Input
                type="number"
                step="0.01"
                value={d.price ?? ""}
                onChange={(e) => set("price", e.target.value)}
              />
            ),
          })}
          {F({
            label: "Preço promocional (R$)",
            children: (
              <Input
                type="number"
                step="0.01"
                value={d.promo_price ?? ""}
                onChange={(e) => set("promo_price", e.target.value || null)}
              />
            ),
          })}
          {F({
            label: "Promoção termina em",
            children: (
              <Input
                type="datetime-local"
                value={d.promo_ends_at ? d.promo_ends_at.slice(0, 16) : ""}
                onChange={(e) =>
                  set(
                    "promo_ends_at",
                    e.target.value ? new Date(e.target.value).toISOString() : null,
                  )
                }
              />
            ),
          })}
          {F({
            label: "Imagem",
            children: (
              <div className="flex items-center gap-2">
                {d.image_url && (
                  <img src={d.image_url} alt="" className="h-9 w-12 rounded object-cover" />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                />
              </div>
            ),
          })}
        </div>
        {F({
          label: "Descrição curta",
          children: (
            <Input
              value={d.short_description ?? ""}
              onChange={(e) => set("short_description", e.target.value)}
            />
          ),
        })}
        {F({
          label: "Descrição completa",
          children: (
            <Textarea
              rows={4}
              value={d.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          ),
        })}
        <div className="grid gap-4 md:grid-cols-2">
          {F({
            label: "Benefícios (um por linha)",
            children: (
              <Textarea
                rows={4}
                value={d.benefitsText ?? ""}
                onChange={(e) => set("benefitsText", e.target.value)}
              />
            ),
          })}
          {F({
            label: "Funcionalidades (uma por linha)",
            children: (
              <Textarea
                rows={4}
                value={d.featuresText ?? ""}
                onChange={(e) => set("featuresText", e.target.value)}
              />
            ),
          })}
        </div>
        {F({
          label: "Informações de entrega",
          children: (
            <Input
              value={d.delivery_info ?? ""}
              onChange={(e) => set("delivery_info", e.target.value)}
            />
          ),
        })}
        <div className="rounded-xl border border-border p-4">
          {F({
            label: "Modalidade de entrega",
            children: (
              <select
                value={d.delivery_type}
                onChange={(e) => set("delivery_type", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="manual">Manual (equipe entrega)</option>
                <option value="licenca">Licença automática</option>
                <option value="arquivo">Arquivo / link de download</option>
              </select>
            ),
          })}
          {d.delivery_type === "licenca" && (
            <div className="mt-3 space-y-1.5">
              <Label>
                Adicionar chaves (uma por linha){" "}
                {licStats && (
                  <span className="text-muted-foreground">
                    — {licStats.free} disponíveis de {licStats.total}
                  </span>
                )}
              </Label>
              <Textarea
                rows={3}
                value={licenses}
                onChange={(e) => setLicenses(e.target.value)}
                className="font-mono"
              />
            </div>
          )}
          {d.delivery_type === "arquivo" && (
            <div className="mt-3 space-y-1.5">
              <Label>Link protegido do arquivo (visível só para compradores após pagamento)</Label>
              <Input
                value={fileUrl ?? ""}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          {(["active", "featured", "bestseller", "is_new", "demo_price"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <Switch checked={!!d[k]} onCheckedChange={(v) => set(k, v)} />
              {
                {
                  active: "Ativo",
                  featured: "Destaque",
                  bestseller: "Mais vendido",
                  is_new: "Novidade",
                  demo_price: "Preço de demonstração",
                }[k]
              }
            </label>
          ))}
        </div>
        <div className="flex justify-between gap-2 pt-2">
          {d.id ? (
            <Button variant="ghost" className="text-destructive" onClick={remove}>
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <Button variant="hero" onClick={save} disabled={busy}>
            {busy ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

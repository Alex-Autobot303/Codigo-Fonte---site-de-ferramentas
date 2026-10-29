import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Flame,
  Headphones,
  Lock,
  ShoppingBag,
  Sparkles,
  Zap,
  MessageCircle,
  Target,
  Megaphone,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProductCard } from "@/components/store/ProductCard";
import { Countdown } from "@/components/store/Countdown";
import { categoriesQuery, productsQuery, type Product } from "@/lib/catalog";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NexaTools — As melhores ferramentas digitais em um só lugar" },
      {
        name: "description",
        content:
          "Automação de WhatsApp, prospecção de leads, inteligência artificial e marketing para o seu negócio.",
      },
      { property: "og:title", content: "NexaTools — Ferramentas digitais" },
      {
        property: "og:description",
        content: "Automação, IA, marketing e soluções profissionais para o seu negócio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const catIcons: Record<string, typeof Zap> = { MessageCircle, Target, Sparkles, Megaphone, Wrench };

function Section({
  title,
  subtitle,
  items,
  id,
}: {
  title: string;
  subtitle?: string;
  items: Product[];
  id?: string;
}) {
  if (!items.length) return null;
  return (
    <section id={id} className="mx-auto max-w-7xl px-4 pt-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Link to="/produtos" className="text-sm font-medium text-primary hover:underline">
          Ver todos
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.slice(0, 8).map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

function Index() {
  const { data: products = [] } = useQuery(productsQuery());
  const { data: cats = [] } = useQuery(categoriesQuery());
  const offers = products.filter((p) => p.promo_price);
  const nextEnd = offers
    .map((p) => p.promo_ends_at)
    .filter(Boolean)
    .sort()[0];
  const recommended = [...products]
    .sort((a, b) => b.sales_count - a.sales_count || a.name.localeCompare(b.name))
    .slice(0, 4);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <img
          src={hero}
          alt=""
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/10" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Marketplace de tecnologia
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] md:text-6xl">
              AS MELHORES <span className="text-brand">FERRAMENTAS DIGITAIS</span> EM UM SÓ LUGAR
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Automação, Inteligência Artificial, Marketing e Soluções Profissionais para o seu
              Negócio.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="hero" size="lg" asChild>
                <Link to="/produtos">
                  <ShoppingBag /> Explorar produtos
                </Link>
              </Button>
              <Button variant="glass" size="lg" asChild>
                <a href="#ofertas">
                  <Flame /> Ver ofertas
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-7xl px-4 pt-14">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {cats.map((c) => {
            const Icon = catIcons[c.icon ?? ""] ?? Zap;
            return (
              <Link
                key={c.id}
                to="/produtos"
                search={{ categoria: c.slug }}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-card-grad p-5 transition hover:border-primary/60 hover:shadow-glow"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-display font-semibold leading-tight">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {products.filter((p) => p.category_id === c.id).length} produtos
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <Section
        title="Produtos em destaque"
        subtitle="Selecionados pela nossa equipe"
        items={products.filter((p) => p.featured)}
      />
      <Section title="Mais vendidos" items={products.filter((p) => p.bestseller)} />

      {offers.length > 0 && (
        <section id="ofertas" className="mx-auto max-w-7xl px-4 pt-16">
          <div className="rounded-3xl border border-violet/40 bg-card-grad p-6 shadow-violet md:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
                  <Flame className="text-violet" /> Ofertas especiais
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Preços especiais por tempo limitado
                </p>
              </div>
              {nextEnd && <Countdown to={nextEnd} />}
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {offers.slice(0, 8).map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Section title="Novidades" items={products.filter((p) => p.is_new)} />
      <Section title="Recomendados para você" items={recommended} />

      {/* ADVANTAGES */}
      <section className="mx-auto max-w-7xl px-4 pt-20">
        <h2 className="mb-6 text-center text-2xl font-bold md:text-3xl">Por que comprar aqui</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              i: Zap,
              t: "Entrega digital",
              d: "Acesso pelo seu painel após a confirmação do pagamento.",
            },
            {
              i: Lock,
              t: "Compra segura",
              d: "Pagamentos confirmados pelo provedor e dados protegidos.",
            },
            {
              i: Headphones,
              t: "Suporte dedicado",
              d: "Central de chamados com protocolo e histórico.",
            },
            {
              i: BadgeCheck,
              t: "Carteira digital",
              d: "Use seu saldo interno para comprar mais rápido.",
            },
          ].map(({ i: I, t, d }) => (
            <div key={t} className="rounded-2xl border border-border bg-card p-6">
              <I className="h-7 w-7 text-primary" />
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pt-20">
        <h2 className="mb-6 text-center text-2xl font-bold md:text-3xl">Perguntas frequentes</h2>
        <Accordion
          type="single"
          collapsible
          className="rounded-2xl border border-border bg-card px-5"
        >
          {[
            [
              "Como recebo meu produto?",
              "Após a confirmação do pagamento, a entrega aparece em Minha conta → Downloads e licenças. Alguns produtos têm entrega manual pela nossa equipe.",
            ],
            [
              "Quais formas de pagamento são aceitas?",
              "Saldo da carteira digital e, em breve, PIX e cartão de crédito via Mercado Pago.",
            ],
            [
              "Posso pedir reembolso?",
              "Sim, conforme nossa política. Abra um chamado na central de suporte informando o número do pedido.",
            ],
            [
              "Os preços exibidos são definitivos?",
              "Sim! Nossos preços são atualizados em tempo real e você pode aproveitar ofertas especiais por tempo limitado.",
            ],
          ].map(([q, a]) => (
            <AccordionItem key={q} value={q ?? ""}>
              <AccordionTrigger className="text-left">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}

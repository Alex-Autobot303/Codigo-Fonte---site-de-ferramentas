import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, CheckCircle2, Code2, Cpu, ExternalLink, Globe, KeyRound, Lock, ShieldCheck, Sparkles, Terminal, Webhook, Zap } from "lucide-react";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Portal de Desenvolvedores — NexaTools B2B REST API" },
      { name: "description", content: "Integre nossa API REST de produtos digitais com bots do Telegram, WhatsApp, SaaS e lojas virtuais." },
    ],
  }),
  component: DevelopersLandingPage,
});

function DevelopersLandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/40 py-20 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-brand/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-40 right-1/4 h-96 w-96 rounded-full bg-violet/20 blur-3xl pointer-events-none" />
        
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet/30 bg-violet/10 px-4 py-1.5 text-xs font-semibold text-violet">
            <Sparkles className="h-3.5 w-3.5" /> API REST B2B Profissional v1.0
          </div>
          <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Venda Produtos Digitais no seu <span className="bg-gradient-to-r from-violet via-fuchsia-400 to-primary bg-clip-text text-transparent">Próprio Sistema</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Conecte seus <strong>Bots do Telegram</strong>, <strong>WhatsApp</strong>, <strong>Lojas Virtuais</strong>, aplicativos e plataformas SaaS à nossa infraestrutura de licenciamento e entrega automática instantânea.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/developers/docs"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              <Terminal className="h-4 w-4" /> Ver Documentação da API <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/revendedor"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-6 py-3.5 text-sm font-semibold backdrop-blur-md transition hover:bg-card hover:border-primary/50"
            >
              <KeyRound className="h-4 w-4 text-violet" /> Gerar Minha API Key
            </Link>
            <a
              href="/api/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-4"
            >
              <ExternalLink className="h-3.5 w-3.5" /> OpenAPI 3.1 Spec
            </a>
          </div>

          {/* Quick Terminal Preview */}
          <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-border/80 bg-slate-950 p-4 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
                <span className="ml-2 font-mono text-xs text-slate-400">POST /api/v1/orders (Exemplo de Compra via Bot)</span>
              </div>
              <span className="rounded bg-violet/20 px-2 py-0.5 font-mono text-[11px] text-violet">Idempotente & Atômico</span>
            </div>
            <pre className="mt-3 overflow-x-auto font-mono text-xs text-slate-300">
              <code>{`curl -X POST https://nexatools.com/api/v1/orders \\
  -H "Authorization: Bearer ak_live_exemplochaveapi123" \\
  -H "Idempotency-Key: e8b9a12c-4f7d-419b-a01c-8e4726bf1092" \\
  -H "Content-Type: application/json" \\
  -d '{
    "product_id": "prod_001",
    "quantity": 1,
    "external_order_id": "telegram_user_#491823"
  }'`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Target Audiences / Integrations Grid */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold">Desenvolvida para Todas as Integrações</h2>
            <p className="mt-2 text-muted-foreground">Compatível com qualquer linguagem e framework HTTP moderno.</p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-sm transition hover:border-violet/40 hover:shadow-glow">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-violet/15 text-violet">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">Bots do Telegram</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Venda produtos digitais diretamente em canais e grupos do Telegram. A API processa e entrega chaves em milissegundos.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-sm transition hover:border-violet/40 hover:shadow-glow">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">Bots do WhatsApp</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Integre Typebot, Evolution API, Baileys e automações de atendimento com débito automático da sua carteira B2B.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-sm transition hover:border-violet/40 hover:shadow-glow">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">Plataformas SaaS & Apps</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Revenda ferramentas em seu software próprio (React, Vue, Flutter, iOS, Android) com controle de margem de lucro.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-sm transition hover:border-violet/40 hover:shadow-glow">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-400">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">Lojas e Plataformas Web</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Conecte seu front-end criado em React, Next.js ou qualquer plataforma diretamente aos endpoints REST B2B com total segurança.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Financial Architecture Highlights */}
      <section className="border-y border-border/40 bg-card/20 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Segurança Financeira Inquebrável
              </div>
              <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
                Controle de Saldo Atômico e Proteção contra Duplicidade
              </h2>
              <p className="mt-4 text-muted-foreground">
                Nossa API foi construída com rigorosas regras de isolamento e concorrência para garantir que sua integração nunca sofra cobranças repetidas ou falhas de saldo.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Chave de Idempotência Obrigatória para Compras</h4>
                    <p className="text-xs text-muted-foreground">
                      Envie o cabeçalho <code className="text-violet">Idempotency-Key</code>. Se uma requisição cair ou sofrer timeout, ao reenviá-la o sistema retorna a entrega original sem cobrar novamente.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Chaves API com Armazenamento Criptografado (SHA-256)</h4>
                    <p className="text-xs text-muted-foreground">
                      Chaves no formato <code className="text-violet">ak_live_...</code> são exibidas apenas uma vez e armazenadas exclusivamente como hash no banco de dados.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Webhooks com Assinatura Criptográfica HMAC-SHA256</h4>
                    <p className="text-xs text-muted-foreground">
                      Receba notificações em tempo real com validação de assinatura no cabeçalho <code className="text-violet">X-Reseller-Signature</code> e proteção avançada contra ataques SSRF.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-slate-950 p-6 shadow-xl">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3 text-xs font-mono text-slate-400">
                <Code2 className="h-4 w-4 text-violet" /> Resposta de Entrega Digital Automática
              </div>
              <pre className="mt-4 overflow-x-auto font-mono text-xs text-emerald-400">
                <code>{`{
  "success": true,
  "data": {
    "order_id": "ORD-1025",
    "external_order_id": "cliente_telegram_941",
    "product_id": "prod_001",
    "product_name": "Bulk Button Pro",
    "quantity": 1,
    "unit_price": 35.00,
    "amount": 35.00,
    "currency": "BRL",
    "status": "completed",
    "delivery_status": "completed",
    "delivery_type": "licenca",
    "created_at": "2026-10-29T00:00:00.000Z"
  }
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Bottom Section */}
      <section className="py-20 text-center">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Pronto para começar a revender?</h2>
          <p className="mt-4 text-muted-foreground">
            Acesse o Painel do Revendedor, recarregue sua carteira com PIX instantâneo e gere sua primeira API Key em menos de 2 minutos.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/revendedor"
              className="rounded-xl bg-violet px-7 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90"
            >
              Acessar Painel do Revendedor
            </Link>
            <Link
              to="/developers/docs"
              className="rounded-xl border border-border bg-card px-7 py-3.5 text-sm font-semibold transition hover:bg-muted"
            >
              Explorar Documentação Interativa
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

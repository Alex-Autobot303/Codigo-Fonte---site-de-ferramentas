import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  KeyRound,
  Play,
  Send,
  ShieldAlert,
  Terminal,
  Zap,
} from "lucide-react";
import { openApiSpecification } from "@/lib/openapi-spec";

export const Route = createFileRoute("/developers/docs")({
  head: () => ({
    meta: [
      { title: "Documentação da API B2B — NexaTools" },
      {
        name: "description",
        content:
          "Referência completa dos endpoints, autenticação, carteira, compras, webhooks e exemplos em JS, TS, Python, PHP e cURL.",
      },
    ],
  }),
  component: ApiDocsPage,
});

type SectionKey =
  | "intro"
  | "auth"
  | "products"
  | "wallet"
  | "orders"
  | "deliveries"
  | "webhooks"
  | "errors"
  | "playground";
type CodeLang = "curl" | "javascript" | "typescript" | "python" | "php";

function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>("intro");
  const [activeLang, setActiveLang] = useState<CodeLang>("curl");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Playground state
  const [testEndpoint, setTestEndpoint] = useState("/api/v1/products");
  const [testMethod, setTestMethod] = useState("GET");
  const [testKey, setTestKey] = useState("ak_live_test_valid_key_12345");
  const [testBody, setTestBody] = useState(`{\n  "product_id": "prod_001",\n  "quantity": 1\n}`);
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [loadingTest, setLoadingTest] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const runPlayground = async () => {
    setLoadingTest(true);
    setTestResponse(null);
    setTestStatus(null);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${testKey.trim()}`,
        "Content-Type": "application/json",
      };
      if (testMethod === "POST") {
        headers["Idempotency-Key"] = `test-${Date.now()}`;
      }

      const res = await fetch(testEndpoint, {
        method: testMethod,
        headers,
        body: testMethod !== "GET" ? testBody : undefined,
      });

      setTestStatus(res.status);
      const data = await res.json().catch(() => ({ raw: "Sem corpo JSON" }));
      setTestResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setTestResponse(JSON.stringify({ error: err.message }, null, 2));
      setTestStatus(500);
    } finally {
      setLoadingTest(false);
    }
  };

  const codeSnippets: Record<CodeLang, string> = {
    curl: `curl -X POST https://nexatools.com/api/v1/orders \\
  -H "Authorization: Bearer ak_live_exemplochaveapi123" \\
  -H "Idempotency-Key: ${crypto.randomUUID ? crypto.randomUUID() : "e8b9a12c-4f7d-419b-a01c-8e4726bf1092"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "product_id": "prod_001",
    "quantity": 1,
    "external_order_id": "meu_pedido_telegram_104"
  }'`,
    javascript: `// Exemplo com Fetch moderno (Node.js 18+ ou Navegador)
const createOrder = async () => {
  const response = await fetch("https://nexatools.com/api/v1/orders", {
    method: "POST",
    headers: {
      "Authorization": "Bearer ak_live_exemplochaveapi123",
      "Idempotency-Key": crypto.randomUUID(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      product_id: "prod_001",
      quantity: 1,
      external_order_id: "cliente_123"
    })
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Falha na compra");
  }
  console.log("Pedido entregue com sucesso:", result.data);
};`,
    typescript: `// Exemplo em TypeScript com tipagem estrita
interface OrderResponse {
  success: boolean;
  data: {
    order_id: string;
    product_id: string;
    amount: number;
    status: string;
    delivery_status: 'completed' | 'pending';
    delivery_type: string;
  };
  error?: string;
}

export async function buyProductB2B(productId: string): Promise<OrderResponse> {
  const res = await fetch("https://nexatools.com/api/v1/orders", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.NEXA_API_KEY,
      "Idempotency-Key": crypto.randomUUID(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ product_id: productId, quantity: 1 })
  });

  return (await res.json()) as OrderResponse;
}`,
    python: `# Exemplo em Python (utilizando requests)
import requests
import uuid

API_KEY = "ak_live_exemplochaveapi123"
BASE_URL = "https://nexatools.com/api/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Idempotency-Key": str(uuid.uuid4()),
    "Content-Type": "application/json"
}

payload = {
    "product_id": "prod_001",
    "quantity": 1,
    "external_order_id": "bot_whatsapp_#5501"
}

response = requests.post(f"{BASE_URL}/orders", headers=headers, json=payload)
data = response.json()

if response.status_code == 201:
    print("Compra aprovada! Número do pedido:", data["data"]["order_id"])
else:
    print("Erro na compra:", data.get("error"))`,
    php: `<?php
// Exemplo em PHP com cURL nativo
$apiKey = "ak_live_exemplochaveapi123";
$idempotencyKey = uniqid("req_", true);

$payload = json_encode([
    "product_id" => "prod_001",
    "quantity" => 1,
    "external_order_id" => "saas_user_#4918"
]);

$ch = curl_init("https://nexatools.com/api/v1/orders");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer " . $apiKey,
    "Idempotency-Key: " . $idempotencyKey,
    "Content-Type: application/json"
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$result = json_decode($response, true);
if ($httpCode === 201) {
    echo "Pedido criado: " . $result["data"]["order_id"];
} else {
    echo "Erro: " . ($result["error"] ?? "Desconhecido");
}
?>`,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/developers" className="hover:text-foreground">
              Desenvolvedores
            </Link>
            <span>/</span>
            <span className="font-semibold text-foreground">Documentação REST v1</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary transition"
            >
              <ExternalLink className="h-3 w-3" /> OpenAPI 3.1 Spec
            </a>
            <Link
              to="/revendedor"
              className="rounded-lg bg-violet px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
            >
              Painel do Revendedor
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Sidebar Navigation */}
          <aside className="space-y-1 overflow-x-auto lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Guia da API
            </div>
            {[
              { id: "intro", label: "1. Introdução" },
              { id: "auth", label: "2. Autenticação" },
              { id: "products", label: "3. Catálogo & Preços" },
              { id: "wallet", label: "4. Carteira & PIX" },
              { id: "orders", label: "5. Compras & Pedidos" },
              { id: "deliveries", label: "6. Entregas & Licenças" },
              { id: "webhooks", label: "7. Webhooks & HMAC" },
              { id: "errors", label: "8. Códigos de Erro" },
              { id: "playground", label: "9. Teste Interativo (Playground)" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as SectionKey)}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  activeSection === item.id
                    ? "bg-violet/15 text-violet font-semibold"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </aside>

          {/* Main Documentation Content */}
          <main className="min-w-0 space-y-12">
            {/* Section 1: Intro */}
            {activeSection === "intro" && (
              <section className="space-y-6">
                <div>
                  <h1 className="font-display text-3xl font-bold">Introdução à API B2B</h1>
                  <p className="mt-2 text-muted-foreground">
                    A API B2B NexaTools permite que revendedores automatizem a compra e entrega de
                    produtos digitais, licenças e ferramentas por meio de bots do Telegram,
                    WhatsApp, lojas virtuais ou plataformas próprias.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card/40 p-6">
                  <h3 className="font-semibold text-base">URL Base da API</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Todas as requisições devem ser enviadas via HTTPS utilizando a URL base oficial:
                  </p>
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-slate-950 p-3 font-mono text-sm text-emerald-400">
                    <span>https://nexatools.com/api/v1</span>
                    <button
                      onClick={() => copyToClipboard("https://nexatools.com/api/v1", "base_url")}
                      className="text-slate-400 hover:text-white"
                      title="Copiar"
                    >
                      {copiedKey === "base_url" ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/80 bg-card/30 p-4">
                    <span className="text-xs text-muted-foreground">Protocolo</span>
                    <div className="mt-1 font-semibold">REST JSON / HTTPS</div>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-card/30 p-4">
                    <span className="text-xs text-muted-foreground">Padrão OpenAPI</span>
                    <div className="mt-1 font-semibold">Versão 3.1.0</div>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-card/30 p-4">
                    <span className="text-xs text-muted-foreground">Taxa Padrão</span>
                    <div className="mt-1 font-semibold">60 reqs / minuto</div>
                  </div>
                </div>
              </section>
            )}

            {/* Section 2: Auth */}
            {activeSection === "auth" && (
              <section className="space-y-6">
                <div>
                  <h1 className="font-display text-3xl font-bold">Autenticação com API Key</h1>
                  <p className="mt-2 text-muted-foreground">
                    A API utiliza chaves Bearer criptograficamente seguras. Para autenticar suas
                    chamadas, inclua sua chave no cabeçalho HTTP{" "}
                    <code className="text-violet">Authorization</code>.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-slate-950 p-5">
                  <span className="text-xs font-mono text-slate-400">Formato do Cabeçalho:</span>
                  <div className="mt-2 font-mono text-sm text-primary">
                    Authorization: Bearer ak_live_exemplochaveapi123
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200">
                      <strong>Aviso de Segurança:</strong> Nunca compartilhe sua API Key em
                      repositórios públicos de código ou no front-end de aplicações de clientes.
                      Guarde-a sempre em variáveis de ambiente seguras (
                      <code className="text-amber-300">process.env</code>,{" "}
                      <code className="text-amber-300">os.environ</code>, etc.).
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Como Obter sua Chave</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>
                      Acesse o{" "}
                      <Link to="/revendedor" className="text-violet underline">
                        Painel do Revendedor
                      </Link>
                      .
                    </li>
                    <li>
                      Vá até a aba <strong>API Keys</strong>.
                    </li>
                    <li>
                      Clique em <strong>Gerar Nova API Key</strong>.
                    </li>
                    <li>
                      Copie e guarde o segredo exibido imediatamente. Ele não poderá ser consultado
                      novamente.
                    </li>
                  </ol>
                </div>
              </section>
            )}

            {/* Section 3: Products */}
            {activeSection === "products" && (
              <section className="space-y-6">
                <div>
                  <h1 className="font-display text-3xl font-bold">Catálogo & Preços B2B</h1>
                  <p className="mt-2 text-muted-foreground">
                    Consulte os produtos disponíveis para revenda, verifique o estoque em tempo real
                    e descubra o preço de custo exclusivo negociado para sua conta.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* GET /products */}
                  <div className="rounded-2xl border border-border bg-card/40 p-6">
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                        GET
                      </span>
                      <span className="font-mono text-sm font-semibold">/products</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Retorna todo o catálogo de produtos digitais com os respectivos preços de
                      custo calculados para o seu perfil.
                    </p>
                    <div className="mt-4 rounded-xl border border-border bg-slate-950 p-4">
                      <span className="text-xs font-mono text-slate-400">Exemplo de Resposta:</span>
                      <pre className="mt-2 overflow-x-auto font-mono text-xs text-slate-300">
                        {`{
  "success": true,
  "data": [
    {
      "id": "prod_001",
      "name": "Bulk Button Pro",
      "slug": "bulk-button-pro",
      "category": "Automação WhatsApp",
      "price": 35.00,
      "retail_price": 97.00,
      "currency": "BRL",
      "available": true,
      "stock": 45,
      "delivery_type": "licenca",
      "short_description": "Envio de mensagens automáticas com botões."
    }
  ]
}`}
                      </pre>
                    </div>
                  </div>

                  {/* GET /products/{id}/stock */}
                  <div className="rounded-2xl border border-border bg-card/40 p-6">
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                        GET
                      </span>
                      <span className="font-mono text-sm font-semibold">
                        /products/{`{id}`}/stock
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Consulta a quantidade em estoque e disponibilidade imediata do produto.
                    </p>
                  </div>

                  {/* GET /products/{id}/price */}
                  <div className="rounded-2xl border border-border bg-card/40 p-6">
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                        GET
                      </span>
                      <span className="font-mono text-sm font-semibold">
                        /products/{`{id}`}/price
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Retorna o preço de custo unitário exclusivo da sua conta para este produto.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Section 4: Wallet */}
            {activeSection === "wallet" && (
              <section className="space-y-6">
                <div>
                  <h1 className="font-display text-3xl font-bold">Carteira & Recargas PIX</h1>
                  <p className="mt-2 text-muted-foreground">
                    Sua conta de revendedor opera em modelo pré-pago. As compras debitam
                    automaticamente o saldo da sua carteira B2B.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* GET /wallet */}
                  <div className="rounded-2xl border border-border bg-card/40 p-6">
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                        GET
                      </span>
                      <span className="font-mono text-sm font-semibold">/wallet</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Consulta o saldo disponível atual.
                    </p>
                    <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-400">
                      {`{
  "success": true,
  "data": {
    "reseller_id": "res_demo_1",
    "balance": 250.00,
    "currency": "BRL"
  }
}`}
                    </pre>
                  </div>

                  {/* POST /wallet/deposits */}
                  <div className="rounded-2xl border border-border bg-card/40 p-6">
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-blue-500/15 px-2.5 py-1 font-mono text-xs font-bold text-blue-400">
                        POST
                      </span>
                      <span className="font-mono text-sm font-semibold">/wallet/deposits</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Gera uma cobrança PIX instantânea com código Copia e Cola e QR Code.
                    </p>
                    <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300">
                      {`// Payload
{ "amount": 100.00 }

// Resposta 201 Created
{
  "success": true,
  "data": {
    "deposit_id": "dep_91283a0f1",
    "amount": 100.00,
    "status": "pending",
    "pix_code": "00020126580014br.gov.bcb.pix0136...",
    "pix_qr_url": "https://api.qrserver.com/v1/create-qr-code/?..."
  }
}`}
                    </pre>
                  </div>
                </div>
              </section>
            )}

            {/* Section 5: Orders */}
            {activeSection === "orders" && (
              <section className="space-y-6">
                <div>
                  <h1 className="font-display text-3xl font-bold">Compras & Idempotência</h1>
                  <p className="mt-2 text-muted-foreground">
                    Compre produtos com desconto em lote ou sob demanda para os clientes do seu bot.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card/40 p-6">
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-blue-500/15 px-2.5 py-1 font-mono text-xs font-bold text-blue-400">
                      POST
                    </span>
                    <span className="font-mono text-sm font-semibold">/orders</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Processa a compra de forma atômica debitando a carteira e liberando a entrega
                    digital correspondente.
                  </p>

                  <div className="mt-4 rounded-xl border border-violet/30 bg-violet/10 p-4">
                    <div className="font-semibold text-xs text-violet">
                      Cabeçalho Recomendado: Idempotency-Key
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Envie um UUID aleatório no cabeçalho{" "}
                      <code className="text-violet">Idempotency-Key</code> em cada compra para
                      proteger contra repetição de cobranças se sua conexão oscilar.
                    </p>
                  </div>

                  <div className="mt-4">
                    <span className="text-xs font-mono text-slate-400">Exemplo de Requisição:</span>
                    <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300">
                      {`{
  "product_id": "prod_001",
  "quantity": 1,
  "external_order_id": "meu_bot_telegram_#9841"
}`}
                    </pre>
                  </div>

                  <div className="mt-4">
                    <span className="text-xs font-mono text-slate-400">
                      Exemplo de Resposta (201 Created):
                    </span>
                    <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-400">
                      {`{
  "success": true,
  "data": {
    "order_id": "ORD-1025",
    "internal_id": "8e41bf12-4091-4e7d-a192-38192a839102",
    "external_order_id": "meu_bot_telegram_#9841",
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
}`}
                    </pre>
                  </div>
                </div>
              </section>
            )}

            {/* Section 6: Deliveries */}
            {activeSection === "deliveries" && (
              <section className="space-y-6">
                <div>
                  <h1 className="font-display text-3xl font-bold">Entregas & Licenças Digitais</h1>
                  <p className="mt-2 text-muted-foreground">
                    Consulte os produtos adquiridos, chaves de ativação, links temporários de
                    download e instruções a qualquer momento.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card/40 p-6">
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                      GET
                    </span>
                    <span className="font-mono text-sm font-semibold">
                      /orders/{`{id}`}/delivery
                    </span>
                  </div>
                  <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300">
                    {`{
  "success": true,
  "data": {
    "order_id": "ORD-1025",
    "delivery_type": "licenca",
    "status": "entregue",
    "content": "NEXA-94B1-29FA-881C",
    "instructions": "Ative sua chave de licença no software baixado.",
    "delivered_at": "2026-10-29T00:00:00.000Z"
  }
}`}
                  </pre>
                </div>
              </section>
            )}

            {/* Section 7: Webhooks */}
            {activeSection === "webhooks" && (
              <section className="space-y-6">
                <div>
                  <h1 className="font-display text-3xl font-bold">Webhooks & Assinatura HMAC</h1>
                  <p className="mt-2 text-muted-foreground">
                    Receba notificações em tempo real sobre pedidos criados, entregas concluídas e
                    confirmação de recargas PIX.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-4">
                  <h3 className="font-semibold text-base">
                    Cabeçalhos de Segurança Enviados nos Webhooks
                  </h3>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="rounded-lg bg-slate-950 p-2.5 text-slate-300">
                      <span className="text-violet">X-Reseller-Signature:</span> Assinatura
                      HMAC-SHA256 do corpo da requisição usando seu segredo de webhook.
                    </div>
                    <div className="rounded-lg bg-slate-950 p-2.5 text-slate-300">
                      <span className="text-violet">X-Reseller-Timestamp:</span> Timestamp Unix em
                      milissegundos para evitar ataques de repetição.
                    </div>
                    <div className="rounded-lg bg-slate-950 p-2.5 text-slate-300">
                      <span className="text-violet">X-Reseller-Event-Id:</span> Identificador único
                      do evento para deduplicação.
                    </div>
                  </div>

                  <h4 className="font-semibold text-sm pt-2">
                    Exemplo de Validação em Node.js (Crypto)
                  </h4>
                  <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300">
                    {`import crypto from "crypto";

function verifyWebhook(rawBody, signature, secret) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return expected === signature;
}`}
                  </pre>
                </div>
              </section>
            )}

            {/* Section 8: Errors */}
            {activeSection === "errors" && (
              <section className="space-y-6">
                <div>
                  <h1 className="font-display text-3xl font-bold">Códigos de Erro & Status HTTP</h1>
                  <p className="mt-2 text-muted-foreground">
                    A API B2B adota os padrões canônicos de códigos de status HTTP da especificação
                    REST:
                  </p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="p-3">Código</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Significado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono text-xs">
                      <tr>
                        <td className="p-3 text-emerald-400 font-bold">200</td>
                        <td className="p-3">OK</td>
                        <td className="p-3 font-sans text-muted-foreground">
                          Requisição processada com sucesso.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 text-emerald-400 font-bold">201</td>
                        <td className="p-3">Created</td>
                        <td className="p-3 font-sans text-muted-foreground">
                          Recurso criado (pedido ou recarga efetuada).
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 text-amber-400 font-bold">400</td>
                        <td className="p-3">Bad Request</td>
                        <td className="p-3 font-sans text-muted-foreground">
                          Saldo insuficiente ou produto indisponível.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 text-red-400 font-bold">401</td>
                        <td className="p-3">Unauthorized</td>
                        <td className="p-3 font-sans text-muted-foreground">
                          API Key ausente ou inválida.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 text-red-400 font-bold">403</td>
                        <td className="p-3">Forbidden</td>
                        <td className="p-3 font-sans text-muted-foreground">
                          Chave revogada ou conta de revendedor suspensa.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 text-amber-400 font-bold">404</td>
                        <td className="p-3">Not Found</td>
                        <td className="p-3 font-sans text-muted-foreground">
                          Produto, pedido ou depósito não localizado.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 text-blue-400 font-bold">409</td>
                        <td className="p-3">Conflict</td>
                        <td className="p-3 font-sans text-muted-foreground">
                          Requisição duplicada já processada ou reembolso pendente.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 text-amber-400 font-bold">422</td>
                        <td className="p-3">Unprocessable Entity</td>
                        <td className="p-3 font-sans text-muted-foreground">
                          Dados inválidos (quantidade zerada, formato incorreto).
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 text-purple-400 font-bold">429</td>
                        <td className="p-3">Too Many Requests</td>
                        <td className="p-3 font-sans text-muted-foreground">
                          Limite de requisições excedido (Rate limit 60 req/min).
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 text-red-500 font-bold">500</td>
                        <td className="p-3">Internal Server Error</td>
                        <td className="p-3 font-sans text-muted-foreground">
                          Falha interna no servidor.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Section 9: Playground */}
            {activeSection === "playground" && (
              <section className="space-y-6">
                <div>
                  <h1 className="font-display text-3xl font-bold">Playground Interativo da API</h1>
                  <p className="mt-2 text-muted-foreground">
                    Teste chamadas reais diretamente contra a API neste ambiente de simulação.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Método</label>
                      <select
                        value={testMethod}
                        onChange={(e) => setTestMethod(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Endpoint
                      </label>
                      <select
                        value={testEndpoint}
                        onChange={(e) => setTestEndpoint(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm font-mono"
                      >
                        <option value="/api/v1/products">GET /api/v1/products</option>
                        <option value="/api/v1/products/prod_001">
                          GET /api/v1/products/prod_001
                        </option>
                        <option value="/api/v1/products/prod_001/stock">
                          GET /api/v1/products/prod_001/stock
                        </option>
                        <option value="/api/v1/products/prod_001/price">
                          GET /api/v1/products/prod_001/price
                        </option>
                        <option value="/api/v1/wallet">GET /api/v1/wallet</option>
                        <option value="/api/v1/wallet/transactions">
                          GET /api/v1/wallet/transactions
                        </option>
                        <option value="/api/v1/orders">GET /api/v1/orders</option>
                        <option value="/api/v1/orders">POST /api/v1/orders (Comprar)</option>
                        <option value="/api/v1/wallet/deposits">
                          POST /api/v1/wallet/deposits (Recarregar PIX)
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      API Key de Teste
                    </label>
                    <input
                      value={testKey}
                      onChange={(e) => setTestKey(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 font-mono text-sm"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      Chave de demonstração pré-configurada com R$ 250,00 de saldo.
                    </span>
                  </div>

                  {testMethod === "POST" && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Corpo da Requisição (JSON)
                      </label>
                      <textarea
                        value={testBody}
                        onChange={(e) => setTestBody(e.target.value)}
                        rows={4}
                        className="mt-1 w-full rounded-xl border border-border bg-slate-950 p-3 font-mono text-xs text-slate-300"
                      />
                    </div>
                  )}

                  <button
                    onClick={runPlayground}
                    disabled={loadingTest}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />{" "}
                    {loadingTest ? "Executando requisição..." : "Executar Chamada"}
                  </button>

                  {testStatus !== null && (
                    <div className="mt-6 rounded-2xl border border-border bg-slate-950 p-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                        <span className="font-mono text-slate-400">Resposta do Servidor:</span>
                        <span
                          className={`font-mono font-bold ${testStatus >= 200 && testStatus < 300 ? "text-emerald-400" : "text-amber-400"}`}
                        >
                          HTTP {testStatus}
                        </span>
                      </div>
                      <pre className="mt-3 max-h-96 overflow-y-auto font-mono text-xs text-emerald-400">
                        {testResponse}
                      </pre>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Code Examples Section (Available on all sections) */}
            <div className="mt-12 rounded-2xl border border-border bg-slate-950 p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                  <Code2 className="h-4 w-4 text-violet" />
                  <span>Exemplo de Código Completo para sua Aplicação:</span>
                </div>
                <div className="flex gap-1 overflow-x-auto">
                  {(["curl", "javascript", "typescript", "python", "php"] as CodeLang[]).map(
                    (lang) => (
                      <button
                        key={lang}
                        onClick={() => setActiveLang(lang)}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs font-semibold transition ${
                          activeLang === lang
                            ? "bg-violet text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {lang.toUpperCase()}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="relative mt-4">
                <button
                  onClick={() => copyToClipboard(codeSnippets[activeLang], "snippet")}
                  className="absolute right-3 top-3 rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-300 hover:text-white"
                  title="Copiar Código"
                >
                  {copiedKey === "snippet" ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <pre className="overflow-x-auto p-2 font-mono text-xs text-slate-300">
                  <code>{codeSnippets[activeLang]}</code>
                </pre>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

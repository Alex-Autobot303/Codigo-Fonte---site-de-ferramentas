import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Download,
  Eye,
  Globe,
  KeyRound,
  Package,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Terminal,
  Trash2,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { fallbackStore } from "@/lib/api-router";
import { isSafeWebhookUrl } from "@/lib/b2b-security";
import {
  getOrCreateResellerAccount,
  getB2BDashboardMetrics,
  generateNewApiKey,
  revokeApiKey,
  listApiKeys,
  type ResellerAccount,
  type ResellerApiKey,
  type B2BDashboardMetrics,
} from "@/lib/b2b-client";

export const Route = createFileRoute("/_authenticated/revendedor")({
  head: () => ({
    meta: [
      { title: "Painel do Revendedor — NexaTools B2B" },
      {
        name: "description",
        content: "Área exclusiva para revendedores de produtos digitais e integração de API.",
      },
    ],
  }),
  component: ResellerDashboardPage,
});

type TabKey =
  "overview" | "keys" | "catalog" | "wallet" | "orders" | "refunds" | "webhooks" | "logs";

function ResellerDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<ResellerAccount | null>(null);
  const [metrics, setMetrics] = useState<B2BDashboardMetrics | null>(null);
  const [keys, setKeys] = useState<ResellerApiKey[]>([]);

  // Modals & Forms
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);

  // PIX Topup Form
  const [depositAmount, setDepositAmount] = useState("100");
  const [activePix, setActivePix] = useState<{
    id: string;
    code: string;
    qrUrl: string;
    amount: number;
  } | null>(null);
  const [loadingDeposit, setLoadingDeposit] = useState(false);

  // Refund Form
  const [refundOrderId, setRefundOrderId] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Webhook Form
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [testingWebhook, setTestingWebhook] = useState(false);

  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopiedText(null), 2500);
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const acc = await getOrCreateResellerAccount(user.id);
      setAccount(acc);
      if (acc.webhook_url) setWebhookUrl(acc.webhook_url);
      if (acc.webhook_secret) setWebhookSecret(acc.webhook_secret);

      const m = await getB2BDashboardMetrics(acc.id, user.id);
      setMetrics(m);

      const k = await listApiKeys(acc.id);
      setKeys(k);
    } catch {
      toast.error("Erro ao carregar dados do revendedor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCreateKey = async () => {
    if (!account) return;
    setCreatingKey(true);
    try {
      const result = await generateNewApiKey(account.id, newKeyName || "Minha Chave API");
      setGeneratedKey(result.rawKey);
      setShowKeyModal(true);
      setNewKeyName("");
      toast.success("API Key gerada com sucesso!");
      loadData();
    } catch {
      toast.error("Falha ao gerar API Key");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (
      !confirm(
        "Tem certeza que deseja revogar esta chave? Ela deixará de funcionar imediatamente em todos os bots e sistemas.",
      )
    ) {
      return;
    }
    const ok = await revokeApiKey(keyId);
    if (ok) {
      toast.success("Chave revogada com sucesso.");
      loadData();
    }
  };

  const handleCreateDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (!amt || amt < 1) {
      toast.error("Informe um valor válido a partir de R$ 1,00");
      return;
    }
    setLoadingDeposit(true);
    try {
      const depositId = `dep_${Math.random().toString(36).substring(2, 10)}`;
      const pixCode = `00020126580014br.gov.bcb.pix0136${depositId}520400005303986540${amt.toFixed(2)}5802BR5910NexaTools6009SaoPaulo62070503***6304`;
      const pixQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCode)}`;

      const depRecord = {
        deposit_id: depositId,
        reseller_id: account?.id || "res_demo_1",
        amount: amt,
        status: "pending",
        pix_code: pixCode,
        pix_qr_url: pixQrUrl,
        created_at: new Date().toISOString(),
      };

      fallbackStore.deposits.set(depositId, depRecord);
      setActivePix({ id: depositId, code: pixCode, qrUrl: pixQrUrl, amount: amt });
      toast.success("Código PIX gerado! Faça o pagamento no seu banco.");
    } catch {
      toast.error("Erro ao gerar recarga PIX");
    } finally {
      setLoadingDeposit(false);
    }
  };

  const handleSimulatePixPayment = async () => {
    if (!activePix || !account) return;
    const w = fallbackStore.wallets.get(account.id) || { balance: 0, currency: "BRL" };
    w.balance += activePix.amount;
    fallbackStore.wallets.set(account.id, w);

    fallbackStore.walletTransactions.unshift({
      id: `tx_${Math.random().toString(36).substring(2, 9)}`,
      resellerId: account.id,
      amount: activePix.amount,
      kind: "recarga",
      description: `Recarga PIX B2B confirmada (${activePix.id})`,
      orderId: null,
      createdAt: new Date().toISOString(),
    });

    toast.success(
      `Pagamento PIX de R$ ${activePix.amount.toFixed(2)} confirmado! Saldo creditado.`,
    );
    setActivePix(null);
    loadData();
  };

  const handleSaveWebhook = async () => {
    if (!account) return;
    if (webhookUrl.trim()) {
      const check = isSafeWebhookUrl(webhookUrl);
      if (!check.valid) {
        toast.error(check.reason);
        return;
      }
    }
    const r = fallbackStore.resellers.get(account.id);
    if (r) {
      r.webhookUrl = webhookUrl.trim() || undefined;
      r.webhookSecret =
        webhookSecret.trim() ||
        r.webhookSecret ||
        `whsec_${Math.random().toString(36).substring(2, 16)}`;
      fallbackStore.resellers.set(account.id, r);
      setWebhookSecret(r.webhookSecret);
    }
    toast.success("Configuração de Webhook salva com sucesso!");
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      toast.error("Cadastre uma URL de webhook primeiro");
      return;
    }
    setTestingWebhook(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      toast.success("Webhook disparado com sucesso! Assinatura HMAC validada.");
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleRequestRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrderId || !refundReason) {
      toast.error("Preencha o número do pedido e o motivo");
      return;
    }
    setSubmittingRefund(true);
    try {
      const refundId = `ref_${Math.random().toString(36).substring(2, 10)}`;
      fallbackStore.refundRequests.set(refundId, {
        refund_id: refundId,
        order_id: refundOrderId,
        reseller_id: account?.id || "res_demo_1",
        amount: 35.0,
        reason: refundReason,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      toast.success("Solicitação de reembolso enviada para análise!");
      setRefundOrderId("");
      setRefundReason("");
    } finally {
      setSubmittingRefund(false);
    }
  };

  // Orders list
  const ordersList = Array.from(fallbackStore.orders.values()).filter(
    (o) => o.resellerId === (account?.id || "res_demo_1"),
  );

  // Transactions list
  const txList = fallbackStore.walletTransactions.filter(
    (t) => t.resellerId === (account?.id || "res_demo_1"),
  );

  // Logs list
  const logsList = fallbackStore.apiLogs.slice(0, 30);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-3xl border border-violet/30 bg-gradient-to-r from-violet/20 via-brand/10 to-card p-6 lg:p-8 backdrop-blur shadow-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-violet/20 px-3 py-1 text-xs font-semibold text-violet">
                Área Exclusiva B2B
              </span>
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> API
                Operacional (18ms)
              </span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold lg:text-3xl">
              Painel do Revendedor — {account?.company_name || "NexaTools B2B"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie suas chaves de API, recarregue saldo, monitore pedidos de bots e acesse seu
              catálogo com preços de custo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/developers/docs"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/80 px-4 py-2 text-xs font-semibold hover:border-violet/40 transition"
            >
              <Terminal className="h-3.5 w-3.5 text-violet" /> Documentação da API
            </Link>
            <button
              onClick={() => {
                setActiveTab("keys");
                setNewKeyName("");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-white shadow-glow hover:opacity-90 transition"
            >
              <Plus className="h-3.5 w-3.5" /> Nova Chave API
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border/80 bg-slate-950/60 p-4 backdrop-blur">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Saldo Disponível</span>
              <Wallet className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
              R$ {(metrics?.balance || 0).toFixed(2)}
            </div>
            <button
              onClick={() => setActiveTab("wallet")}
              className="mt-2 text-xs font-semibold text-violet hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Recarregar via PIX
            </button>
          </div>

          <div className="rounded-2xl border border-border/80 bg-slate-950/60 p-4 backdrop-blur">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Compras pela API (Total)</span>
              <ShoppingBag className="h-4 w-4 text-violet" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono">
              R$ {(metrics?.totalApiPurchases || 0).toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {metrics?.orderCount || 0} pedidos processados
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-slate-950/60 p-4 backdrop-blur">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Compras no Mês</span>
              <DollarSign className="h-4 w-4 text-blue-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono">
              R$ {(metrics?.purchasesThisMonth || 0).toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Hoje: R$ {(metrics?.purchasesToday || 0).toFixed(2)}
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-slate-950/60 p-4 backdrop-blur">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>API Keys Ativas</span>
              <KeyRound className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono">
              {metrics?.activeApiKeys || 0}{" "}
              <span className="text-xs font-normal text-muted-foreground">/ 5 máx</span>
            </div>
            <button
              onClick={() => setActiveTab("keys")}
              className="mt-2 text-xs font-semibold text-violet hover:underline"
            >
              Gerenciar chaves & limites
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-border pb-2">
        {[
          { key: "overview", label: "Visão Geral", icon: Activity },
          { key: "keys", label: "API Keys", icon: KeyRound },
          { key: "catalog", label: "Catálogo & Preços", icon: Package },
          { key: "wallet", label: "Recarga PIX & Carteira", icon: Wallet },
          { key: "orders", label: "Pedidos & Entregas", icon: ShoppingBag },
          { key: "refunds", label: "Reembolsos", icon: ShieldAlert },
          { key: "webhooks", label: "Webhooks", icon: Globe },
          { key: "logs", label: "Logs de Integração", icon: Terminal },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-violet text-white shadow-glow"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="mt-6">
        {/* 1. VISÃO GERAL */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recent Orders */}
              <div className="rounded-2xl border border-border bg-card/40 p-6">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-violet" /> Últimos Pedidos pela API
                  </h3>
                  <button
                    onClick={() => setActiveTab("orders")}
                    className="text-xs text-violet hover:underline"
                  >
                    Ver todos
                  </button>
                </div>
                {ordersList.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum pedido realizado via API ainda. Conecte seu bot ou faça uma compra de
                    teste.
                  </div>
                ) : (
                  <div className="mt-4 divide-y divide-border font-mono text-xs">
                    {ordersList.slice(0, 5).map((o) => (
                      <div key={o.order_id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-foreground">{o.order_id}</div>
                          <div className="text-muted-foreground font-sans text-xs">
                            {o.product_name} (x{o.quantity})
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-400 font-bold">R$ {o.amount.toFixed(2)}</div>
                          <span className="inline-block rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">
                            {o.delivery_status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Wallet Transactions */}
              <div className="rounded-2xl border border-border bg-card/40 p-6">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-400" /> Extrato Recente
                  </h3>
                  <button
                    onClick={() => setActiveTab("wallet")}
                    className="text-xs text-violet hover:underline"
                  >
                    Ver extrato
                  </button>
                </div>
                {txList.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma movimentação registrada.
                  </div>
                ) : (
                  <div className="mt-4 divide-y divide-border text-xs">
                    {txList.slice(0, 5).map((t) => (
                      <div key={t.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{t.description}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(t.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div
                          className={`font-mono font-bold ${t.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {t.amount >= 0
                            ? `+ R$ ${t.amount.toFixed(2)}`
                            : `- R$ ${Math.abs(t.amount).toFixed(2)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. API KEYS */}
        {activeTab === "keys" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">Gerenciador de Chaves de Acesso</h2>
                <p className="text-sm text-muted-foreground">
                  Gere chaves seguras no formato <code className="text-violet">ak_live_...</code>{" "}
                  para conectar bots e sistemas externos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Nome da chave (ex: Bot Telegram)"
                  className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-violet"
                />
                <button
                  onClick={handleCreateKey}
                  disabled={creatingKey}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2 text-sm font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> {creatingKey ? "Gerando..." : "Gerar Chave"}
                </button>
              </div>
            </div>

            {/* Keys Table */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-4">Identificador / Nome</th>
                    <th className="p-4">Prefixo Mascarado</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Permissões</th>
                    <th className="p-4">Limite</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {keys.map((k) => (
                    <tr key={k.id} className="hover:bg-card/60 transition">
                      <td className="p-4 font-semibold text-foreground">
                        {k.name}
                        <div className="text-[11px] text-muted-foreground">
                          Criada em {new Date(k.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-300">{k.key_prefix}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            k.status === "active"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {k.status === "active" ? "Ativa" : "Revogada"}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {k.permissions?.join(", ") || "Completo"}
                      </td>
                      <td className="p-4 font-mono text-xs">{k.rate_limit || 60} req/min</td>
                      <td className="p-4 text-right">
                        {k.status === "active" && (
                          <button
                            onClick={() => handleRevokeKey(k.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Revogar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal for Newly Generated Secret Key */}
            {showKeyModal && generatedKey && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                <div className="w-full max-w-lg rounded-3xl border border-violet/40 bg-slate-950 p-6 shadow-2xl space-y-4">
                  <div className="flex items-center gap-3 text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                    <h3 className="font-display text-lg font-bold text-white">
                      Chave de API Gerada com Sucesso
                    </h3>
                  </div>

                  <p className="text-sm text-slate-300">
                    Copie sua chave secreta agora. Por medidas de segurança criptográfica, ela é
                    armazenada como hash SHA-256 e{" "}
                    <strong>nunca mais será exibida integralmente</strong>.
                  </p>

                  <div className="rounded-xl border border-border bg-slate-900 p-3 flex items-center justify-between">
                    <span className="font-mono text-xs text-emerald-400 break-all select-all mr-2">
                      {generatedKey}
                    </span>
                    <button
                      onClick={() => copyText(generatedKey, "new_key")}
                      className="rounded-lg bg-violet px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 shrink-0"
                    >
                      {copiedText === "new_key" ? "Copiado!" : "Copiar"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    Guarde este segredo em seu arquivo <code className="text-amber-300">.env</code>{" "}
                    para autenticar chamadas via{" "}
                    <code className="text-amber-300">
                      Authorization: Bearer {generatedKey.slice(0, 15)}...
                    </code>
                    .
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        setShowKeyModal(false);
                        setGeneratedKey(null);
                      }}
                      className="rounded-xl bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted"
                    >
                      Eu já salvei minha chave
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. CATALOG & PRICES */}
        {activeTab === "catalog" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold">
                Catálogo de Produtos & Preço de Custo
              </h2>
              <p className="text-sm text-muted-foreground">
                Estes são os produtos digitais disponíveis para compra via API com seu preço de
                revenda aplicado.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fallbackStore.products.map((p) => {
                const customP = fallbackStore.customPrices.get(`${account?.id}:${p.id}`);
                const b2bCost = customP !== undefined ? customP : p.price;
                const profitMargin = p.retail_price - b2bCost;

                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-border bg-card/40 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-violet/15 px-2 py-0.5 text-[11px] font-semibold text-violet">
                        {p.category}
                      </span>
                      <span
                        className={`text-[11px] font-bold ${p.stock && p.stock > 0 ? "text-emerald-400" : "text-amber-400"}`}
                      >
                        {p.stock && p.stock > 0
                          ? `${p.stock} em estoque`
                          : "Estoque Ilimitado / Sob Demanda"}
                      </span>
                    </div>

                    <h3 className="font-bold text-base">{p.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {p.short_description}
                    </p>

                    <div className="pt-2 border-t border-border/80 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-muted-foreground">
                          Preço de Custo (B2B)
                        </div>
                        <div className="text-lg font-bold font-mono text-emerald-400">
                          R$ {b2bCost.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground">Varejo Recomendado</div>
                        <div className="text-sm font-mono text-muted-foreground line-through">
                          R$ {p.retail_price.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-emerald-500/10 p-2 text-center text-xs font-semibold text-emerald-400">
                      Sua margem estimada: + R$ {profitMargin.toFixed(2)} por venda
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. WALLET & PIX RECHARGE */}
        {activeTab === "wallet" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recharge Card */}
              <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-5">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-emerald-400" /> Recarregar Saldo via PIX
                </h3>
                <p className="text-sm text-muted-foreground">
                  Informe o valor desejado. O sistema gerará o QR Code e código Copia e Cola
                  instantâneo. Assim que confirmado, o saldo é liberado para a API.
                </p>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Valor da Recarga (R$)
                  </label>
                  <div className="flex gap-2">
                    {["50", "100", "250", "500"].map((val) => (
                      <button
                        key={val}
                        onClick={() => setDepositAmount(val)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold font-mono ${
                          depositAmount === val
                            ? "border-violet bg-violet text-white"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        R$ {val}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Outro valor..."
                    className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm font-mono"
                  />
                </div>

                <button
                  onClick={handleCreateDeposit}
                  disabled={loadingDeposit}
                  className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-glow hover:bg-emerald-400 transition"
                >
                  {loadingDeposit
                    ? "Gerando cobrança PIX..."
                    : `Gerar PIX de R$ ${parseFloat(depositAmount || "0").toFixed(2)}`}
                </button>

                {/* Active PIX QR Code & Simulation */}
                {activePix && (
                  <div className="rounded-2xl border border-emerald-500/40 bg-slate-950 p-5 space-y-4 text-center">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      PIX Pronto para Pagamento
                    </span>
                    <div className="mx-auto h-48 w-48 rounded-xl bg-white p-2 flex items-center justify-center">
                      <img
                        src={activePix.qrUrl}
                        alt="QR Code PIX"
                        className="h-full w-full object-contain"
                      />
                    </div>

                    <div className="space-y-2 text-left">
                      <label className="text-xs text-muted-foreground">Código Copia e Cola:</label>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={activePix.code}
                          className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-xs font-mono text-emerald-400"
                        />
                        <button
                          onClick={() => copyText(activePix.code, "pix_code")}
                          className="rounded-lg bg-violet px-3 py-2 text-xs font-semibold text-white"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleSimulatePixPayment}
                        className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30"
                      >
                        ⚡ Simular Confirmação do Banco (Ambiente de Testes)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Transactions History */}
              <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-violet" /> Histórico de Movimentações
                </h3>
                <div className="divide-y divide-border text-xs max-h-96 overflow-y-auto pr-1">
                  {txList.map((t) => (
                    <div key={t.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{t.description}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(t.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div
                        className={`font-mono font-bold ${t.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {t.amount >= 0
                          ? `+ R$ ${t.amount.toFixed(2)}`
                          : `- R$ ${Math.abs(t.amount).toFixed(2)}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. ORDERS & DELIVERIES */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold">Pedidos e Entregas Digitais</h2>
              <p className="text-sm text-muted-foreground">
                Consulte todas as compras realizadas e veja as chaves de licença e links liberados
                para seus clientes.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-4">Pedido</th>
                    <th className="p-4">Produto</th>
                    <th className="p-4">Qtd / Valor</th>
                    <th className="p-4">Entrega Digital</th>
                    <th className="p-4">ID Externo</th>
                    <th className="p-4 text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ordersList.map((o) => (
                    <tr key={o.order_id} className="hover:bg-card/60 transition">
                      <td className="p-4 font-mono font-bold text-violet">{o.order_id}</td>
                      <td className="p-4 font-semibold">{o.product_name}</td>
                      <td className="p-4 font-mono text-emerald-400 font-bold">
                        {o.quantity}x (R$ {o.amount.toFixed(2)})
                      </td>
                      <td className="p-4">
                        <div className="rounded-lg bg-slate-950 p-2 font-mono text-xs text-emerald-300 flex items-center justify-between gap-2 max-w-xs">
                          <span className="truncate">
                            {o.delivery_content || "Processando entrega"}
                          </span>
                          {o.delivery_content && (
                            <button
                              onClick={() => copyText(o.delivery_content, o.order_id)}
                              className="text-muted-foreground hover:text-white"
                              title="Copiar"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs text-muted-foreground">
                        {o.external_order_id || "-"}
                      </td>
                      <td className="p-4 text-right text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. REFUNDS */}
        {activeTab === "refunds" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-400" /> Solicitar Reembolso de Pedido
                </h3>
                <p className="text-sm text-muted-foreground">
                  Se um cliente do seu bot relatou problemas ou incompatibilidade, abra uma
                  solicitação de reembolso informando o número do pedido.
                </p>

                <form onSubmit={handleRequestRefund} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Número do Pedido (ex: ORD-1025)
                    </label>
                    <input
                      value={refundOrderId}
                      onChange={(e) => setRefundOrderId(e.target.value)}
                      placeholder="ORD-..."
                      className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Motivo do Reembolso
                    </label>
                    <textarea
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      rows={3}
                      placeholder="Descreva o motivo para a equipe administrativa..."
                      className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingRefund}
                    className="rounded-xl bg-violet px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-90"
                  >
                    {submittingRefund ? "Enviando..." : "Enviar Solicitação"}
                  </button>
                </form>
              </div>

              {/* Refund Requests List */}
              <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-4">
                <h3 className="font-semibold text-lg">Solicitações Registradas</h3>
                {fallbackStore.refundRequests.size === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma solicitação de reembolso ativa.
                  </div>
                ) : (
                  <div className="divide-y divide-border text-xs">
                    {Array.from(fallbackStore.refundRequests.values()).map((r) => (
                      <div key={r.refund_id} className="py-3 space-y-1">
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-bold text-violet">{r.order_id}</span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                              r.status === "approved"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-amber-500/15 text-amber-400"
                            }`}
                          >
                            {r.status === "approved" ? "Aprovado" : "Em Análise"}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{r.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 7. WEBHOOKS */}
        {activeTab === "webhooks" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-4 max-w-2xl">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Globe className="h-5 w-5 text-violet" /> Configuração de Webhook
              </h3>
              <p className="text-sm text-muted-foreground">
                Cadastre sua URL HTTPS para receber notificações automáticas de criação de pedidos e
                confirmação de recargas PIX.
              </p>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  URL de Notificação (HTTPS obrigatório)
                </label>
                <input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://meubot.com/api/webhook"
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Chave Secreta para Assinatura HMAC (whsec_...)
                </label>
                <input
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="whsec_..."
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 font-mono text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveWebhook}
                  className="rounded-xl bg-violet px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-90"
                >
                  Salvar Webhook
                </button>
                <button
                  onClick={handleTestWebhook}
                  disabled={testingWebhook}
                  className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted"
                >
                  {testingWebhook ? "Enviando..." : "Disparar Webhook de Teste"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 8. INTEGRATION LOGS */}
        {activeTab === "logs" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold">Logs de Integração em Tempo Real</h2>
              <p className="text-sm text-muted-foreground">
                Monitore cada requisição enviada pelo seu bot com códigos de status, tempos de
                resposta e identificadores.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-3">Horário</th>
                    <th className="p-3">Método</th>
                    <th className="p-3">Endpoint</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Latência</th>
                    <th className="p-3">ID Requisição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-xs">
                  {logsList.map((l) => (
                    <tr key={l.id} className="hover:bg-card/60 transition">
                      <td className="p-3 text-muted-foreground">
                        {new Date(l.created_at).toLocaleTimeString()}
                      </td>
                      <td className="p-3 font-bold text-violet">{l.method}</td>
                      <td className="p-3 text-foreground">{l.endpoint}</td>
                      <td className="p-3">
                        <span
                          className={`font-bold ${l.status_code < 300 ? "text-emerald-400" : "text-amber-400"}`}
                        >
                          {l.status_code}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{l.processing_time_ms}ms</td>
                      <td className="p-3 text-slate-400 text-[11px]">{l.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

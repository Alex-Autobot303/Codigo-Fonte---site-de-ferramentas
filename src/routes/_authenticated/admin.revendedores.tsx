import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Edit2,
  KeyRound,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Sliders,
  Terminal,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { fallbackStore } from "@/lib/api-router";
import { hashApiKey } from "@/lib/b2b-security";

export const Route = createFileRoute("/_authenticated/admin/revendedores")({
  head: () => ({
    meta: [
      { title: "🔌 API B2B — Revendedores | NexaTools Admin" },
      { name: "description", content: "Gerenciamento central da API B2B para revendedores." },
    ],
  }),
  component: AdminResellersPage,
});

type AdminTab = "overview" | "resellers" | "prices" | "keys" | "logs" | "settings";

function AdminResellersPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // State
  const [resellers, setResellers] = useState(Array.from(fallbackStore.resellers.values()));
  const [products, setProducts] = useState(fallbackStore.products);
  const [customPrices, setCustomPrices] = useState(fallbackStore.customPrices);
  const [apiLogs, setApiLogs] = useState(fallbackStore.apiLogs);

  // Settings State
  const [apiActive, setApiActive] = useState(true);
  const [defaultRateLimit, setDefaultRateLimit] = useState(60);
  const [minDeposit, setMinDeposit] = useState(20);
  const [requireApproval, setRequireApproval] = useState(false);

  // New Reseller Modal
  const [newResellerName, setNewResellerName] = useState("");
  const [showAddReseller, setShowAddReseller] = useState(false);

  // Edit Price Modal
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [newB2BPrice, setNewB2BPrice] = useState("");

  const totalWalletsBalance = Array.from(fallbackStore.wallets.values()).reduce(
    (acc, w) => acc + (w.balance || 0),
    0,
  );

  const totalApiOrders = fallbackStore.orders.size;
  const b2bRevenue = Array.from(fallbackStore.orders.values()).reduce(
    (acc, o) => acc + (o.amount || 0),
    0,
  );

  const handleToggleResellerStatus = (resellerId: string) => {
    const r = fallbackStore.resellers.get(resellerId);
    if (!r) return;
    r.status = r.status === "active" ? "suspended" : "active";
    fallbackStore.resellers.set(resellerId, r);
    setResellers(Array.from(fallbackStore.resellers.values()));
    toast.success(`Revendedor ${r.companyName} agora está ${r.status === "active" ? "Ativo" : "Suspenso"}`);
  };

  const handleCreateReseller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResellerName.trim()) return;
    const newId = `res_${Math.random().toString(36).substring(2, 8)}`;
    const newRecord = {
      id: newId,
      userId: `usr_${Math.random().toString(36).substring(2, 8)}`,
      status: "active",
      companyName: newResellerName.trim(),
    };
    fallbackStore.resellers.set(newId, newRecord);
    fallbackStore.wallets.set(newId, { balance: 0, currency: "BRL" });
    setResellers(Array.from(fallbackStore.resellers.values()));
    setNewResellerName("");
    setShowAddReseller(false);
    toast.success("Novo revendedor B2B cadastrado com sucesso!");
  };

  const handleSavePrice = () => {
    if (!editingProduct) return;
    const priceNum = parseFloat(newB2BPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Informe um preço válido");
      return;
    }
    editingProduct.price = priceNum;
    setEditingProduct(null);
    setProducts([...fallbackStore.products]);
    toast.success(`Preço de custo B2B atualizado para R$ ${priceNum.toFixed(2)}`);
  };

  const handleRevokeKey = (keyHash: string) => {
    const k = fallbackStore.apiKeys.get(keyHash);
    if (k) {
      k.status = "revoked";
      fallbackStore.apiKeys.set(keyHash, k);
      toast.success("Chave revogada!");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet/20 px-3 py-1 text-xs font-semibold text-violet">Admin B2B</span>
            <span className={`text-xs font-semibold ${apiActive ? "text-emerald-400" : "text-red-400"}`}>
              {apiActive ? "● API REST Ativa" : "○ API em Manutenção"}
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold lg:text-3xl">🔌 API B2B — REVENDEDORES</h1>
          <p className="text-sm text-muted-foreground">
            Painel de controle central de parceiros revendedores, catálogos B2B, chaves criptográficas e auditoria de tráfego.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddReseller(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-xs font-semibold text-white shadow-glow hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Cadastrar Revendedor
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-2">
        {[
          { key: "overview", label: "Visão Geral", icon: Activity },
          { key: "resellers", label: "Revendedores", icon: Users },
          { key: "prices", label: "Preços B2B", icon: DollarSign },
          { key: "keys", label: "API Keys", icon: KeyRound },
          { key: "logs", label: "Logs de Requisições", icon: Terminal },
          { key: "settings", label: "Configurações", icon: Settings },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as AdminTab)}
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

      {/* TAB 1: VISÃO GERAL */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <span className="text-xs text-muted-foreground">Total de Revendedores</span>
              <div className="mt-2 text-2xl font-bold font-mono">{resellers.length}</div>
              <div className="mt-1 text-xs text-emerald-400">
                {resellers.filter((r) => r.status === "active").length} ativos
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <span className="text-xs text-muted-foreground">Compras via API (Total)</span>
              <div className="mt-2 text-2xl font-bold font-mono">{totalApiOrders}</div>
              <div className="mt-1 text-xs text-muted-foreground">Pedidos concluídos</div>
            </div>

            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <span className="text-xs text-muted-foreground">Faturamento B2B</span>
              <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
                R$ {b2bRevenue.toFixed(2)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Volume transacionado</div>
            </div>

            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <span className="text-xs text-muted-foreground">Saldo Total em Carteiras</span>
              <div className="mt-2 text-2xl font-bold font-mono text-violet">
                R$ {totalWalletsBalance.toFixed(2)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Pré-pago em custódia</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REVENDEDORES */}
      {activeTab === "resellers" && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">Empresa / Revendedor</th>
                  <th className="p-4">ID Conta</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Saldo Carteira</th>
                  <th className="p-4">Webhook</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {resellers.map((r) => {
                  const balance = fallbackStore.wallets.get(r.id)?.balance || 0;
                  return (
                    <tr key={r.id} className="hover:bg-card/60 transition">
                      <td className="p-4 font-semibold text-foreground">{r.companyName}</td>
                      <td className="p-4 font-mono text-xs text-muted-foreground">{r.id}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                        }`}>
                          {r.status === "active" ? "Ativo" : "Suspenso"}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-emerald-400">R$ {balance.toFixed(2)}</td>
                      <td className="p-4 text-xs font-mono text-muted-foreground truncate max-w-xs">
                        {r.webhookUrl || "Não configurado"}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleResellerStatus(r.id)}
                          className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                            r.status === "active"
                              ? "border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                              : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          }`}
                        >
                          {r.status === "active" ? "Suspender" : "Reativar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PREÇOS B2B */}
      {activeTab === "prices" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-lg font-bold">Configuração de Preços de Custo B2B</h2>
            <p className="text-sm text-muted-foreground">
              Defina o preço de custo que os revendedores pagarão na compra direta via API.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">Produto</th>
                  <th className="p-4">Categoria</th>
                  <th className="p-4">Preço de Varejo (Loja)</th>
                  <th className="p-4">Preço de Custo (B2B)</th>
                  <th className="p-4">Margem do Revendedor</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => {
                  const profit = p.retail_price - p.price;
                  return (
                    <tr key={p.id} className="hover:bg-card/60 transition">
                      <td className="p-4 font-semibold">{p.name}</td>
                      <td className="p-4 text-xs text-muted-foreground">{p.category}</td>
                      <td className="p-4 font-mono">R$ {p.retail_price.toFixed(2)}</td>
                      <td className="p-4 font-mono font-bold text-emerald-400">R$ {p.price.toFixed(2)}</td>
                      <td className="p-4 font-mono text-violet font-semibold">+ R$ {profit.toFixed(2)}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setEditingProduct(p);
                            setNewB2BPrice(p.price.toString());
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold hover:border-violet"
                        >
                          <Edit2 className="h-3 w-3" /> Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Edit Price Modal */}
          {editingProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-3xl border border-border bg-slate-950 p-6 shadow-2xl space-y-4">
                <h3 className="font-bold text-lg">Alterar Preço B2B: {editingProduct.name}</h3>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Preço de Custo B2B (R$)</label>
                  <input
                    type="number"
                    value={newB2BPrice}
                    onChange={(e) => setNewB2BPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-slate-900 p-2.5 font-mono text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setEditingProduct(null)}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSavePrice}
                    className="rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-white"
                  >
                    Salvar Novo Preço
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: API KEYS */}
      {activeTab === "keys" && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">Identificador</th>
                  <th className="p-4">Prefixo</th>
                  <th className="p-4">Revendedor</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Limite</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-xs">
                {Array.from(fallbackStore.apiKeys.entries()).map(([hash, k]) => (
                  <tr key={hash} className="hover:bg-card/60 transition">
                    <td className="p-4 font-semibold font-sans text-foreground">{k.id}</td>
                    <td className="p-4 text-slate-300">{k.keyPrefix}</td>
                    <td className="p-4 font-sans text-muted-foreground">{k.resellerId}</td>
                    <td className="p-4">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        k.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}>
                        {k.status}
                      </span>
                    </td>
                    <td className="p-4">{k.rateLimit} req/min</td>
                    <td className="p-4 text-right">
                      {k.status === "active" && (
                        <button
                          onClick={() => handleRevokeKey(hash)}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-400 font-sans font-semibold hover:bg-red-500/20"
                        >
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: LOGS */}
      {activeTab === "logs" && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Horário</th>
                  <th className="p-3">Revendedor</th>
                  <th className="p-3">Método</th>
                  <th className="p-3">Endpoint</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Latência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-xs">
                {apiLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-card/60 transition">
                    <td className="p-3 text-muted-foreground">{new Date(l.created_at).toLocaleTimeString()}</td>
                    <td className="p-3 font-sans text-slate-300">{l.reseller_id || "Anônimo"}</td>
                    <td className="p-3 font-bold text-violet">{l.method}</td>
                    <td className="p-3 text-foreground">{l.endpoint}</td>
                    <td className="p-3 font-bold text-emerald-400">{l.status_code}</td>
                    <td className="p-3 text-muted-foreground">{l.processing_time_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: CONFIGURAÇÕES */}
      {activeTab === "settings" && (
        <div className="space-y-6 max-w-2xl">
          <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-5">
            <h3 className="font-semibold text-lg">Parâmetros Globais da API B2B</h3>

            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <div className="font-semibold text-sm">Habilitar API REST B2B</div>
                <div className="text-xs text-muted-foreground">Se desativada, todas as chamadas externas retornarão 503 Service Unavailable</div>
              </div>
              <input
                type="checkbox"
                checked={apiActive}
                onChange={(e) => setApiActive(e.target.checked)}
                className="h-5 w-5 accent-violet cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Limite Padrão de Requisições (por minuto)</label>
              <input
                type="number"
                value={defaultRateLimit}
                onChange={(e) => setDefaultRateLimit(parseInt(e.target.value, 10))}
                className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Depósito Mínimo para Recarga PIX (R$)</label>
              <input
                type="number"
                value={minDeposit}
                onChange={(e) => setMinDeposit(parseFloat(e.target.value))}
                className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm font-mono"
              />
            </div>

            <button
              onClick={() => toast.success("Configurações salvas com sucesso!")}
              className="rounded-xl bg-violet px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-90"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      )}

      {/* Modal Add Reseller */}
      {showAddReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateReseller} className="w-full max-w-md rounded-3xl border border-border bg-slate-950 p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg">Cadastrar Novo Revendedor B2B</h3>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Nome da Empresa / Parceiro</label>
              <input
                value={newResellerName}
                onChange={(e) => setNewResellerName(e.target.value)}
                placeholder="Ex: BotMaster Brasil"
                className="mt-1 w-full rounded-xl border border-border bg-slate-900 p-2.5 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddReseller(false)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-white"
              >
                Salvar Cadastro
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

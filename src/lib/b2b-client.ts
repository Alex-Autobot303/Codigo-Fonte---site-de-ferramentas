import { supabase } from "@/integrations/supabase/client";
import { generateApiKey, hashApiKey, generateWebhookSignature } from "./b2b-security";
import { fallbackStore } from "./api-router";

export interface ResellerAccount {
  id: string;
  user_id: string;
  status: "pending" | "active" | "suspended" | "rejected";
  company_name: string | null;
  document: string | null;
  phone: string | null;
  max_api_keys: number;
  rate_limit_per_minute: number;
  webhook_url: string | null;
  webhook_secret: string | null;
  created_at: string;
}

export interface ResellerApiKey {
  id: string;
  name: string;
  key_prefix: string;
  status: "active" | "revoked";
  permissions: string[];
  rate_limit: number;
  last_used_at: string | null;
  created_at: string;
}

export interface B2BDashboardMetrics {
  balance: number;
  totalApiPurchases: number;
  orderCount: number;
  purchasesToday: number;
  purchasesThisMonth: number;
  totalSpent: number;
  activeApiKeys: number;
  apiStatus: "operational" | "degraded" | "maintenance";
}

/**
 * Loads or initializes the current user's Reseller Account
 */
export async function getOrCreateResellerAccount(userId: string): Promise<ResellerAccount> {
  // 1. Try Supabase
  try {
    const { data, error } = await supabase
      .from("reseller_accounts" as any)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      return data as unknown as ResellerAccount;
    }

    // If not found, create new active account
    const { data: created, error: createErr } = await supabase
      .from("reseller_accounts" as any)
      .insert({
        user_id: userId,
        status: "active",
        company_name: "Minha Empresa / Bot",
        max_api_keys: 5,
        rate_limit_per_minute: 60,
      })
      .select()
      .single();

    if (!createErr && created) {
      return created as unknown as ResellerAccount;
    }
  } catch (err) {
    // If table not migrated yet, use fallbackStore
  }

  // 2. Fallback in-memory
  let found = Array.from(fallbackStore.resellers.values()).find((r) => r.userId === userId);
  if (!found) {
    const id = `res_${userId.substring(0, 8)}`;
    found = {
      id,
      userId,
      status: "active",
      companyName: "Minha Empresa Revendedora",
      webhookUrl: undefined,
      webhookSecret: undefined,
    };
    fallbackStore.resellers.set(id, found);
    fallbackStore.wallets.set(id, { balance: 150.0, currency: "BRL" });
  }

  return {
    id: found.id,
    user_id: found.userId,
    status: found.status as any,
    company_name: found.companyName,
    document: "00.000.000/0001-00",
    phone: "(11) 99999-9999",
    max_api_keys: 5,
    rate_limit_per_minute: 60,
    webhook_url: found.webhookUrl || null,
    webhook_secret: found.webhookSecret || null,
    created_at: new Date().toISOString(),
  };
}

/**
 * Fetches dashboard statistics
 */
export async function getB2BDashboardMetrics(resellerId: string, userId: string): Promise<B2BDashboardMetrics> {
  let balance = 0;
  // Get wallet
  try {
    const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
    if (w) balance = Number(w.balance);
  } catch {}

  if (balance === 0 && fallbackStore.wallets.has(resellerId)) {
    balance = fallbackStore.wallets.get(resellerId)!.balance;
  }

  // Get orders
  const orders = Array.from(fallbackStore.orders.values()).filter((o) => o.resellerId === resellerId);
  const orderCount = orders.length;
  const totalSpent = orders.reduce((acc, o) => acc + (o.amount || 0), 0);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let purchasesToday = 0;
  let purchasesThisMonth = 0;

  for (const o of orders) {
    const oTime = new Date(o.created_at).getTime();
    if (oTime >= startOfDay) purchasesToday += o.amount || 0;
    if (oTime >= startOfMonth) purchasesThisMonth += o.amount || 0;
  }

  // Active API keys count
  let activeKeys = 0;
  try {
    const { count } = await supabase
      .from("reseller_api_keys" as any)
      .select("id", { count: "exact", head: true })
      .eq("reseller_id", resellerId)
      .eq("status", "active");
    if (count !== null) activeKeys = count;
  } catch {}

  if (activeKeys === 0) {
    activeKeys = Array.from(fallbackStore.apiKeys.values()).filter(
      (k) => k.resellerId === resellerId && k.status === "active",
    ).length;
  }

  return {
    balance,
    totalApiPurchases: totalSpent,
    orderCount,
    purchasesToday,
    purchasesThisMonth,
    totalSpent,
    activeApiKeys: activeKeys,
    apiStatus: "operational",
  };
}

/**
 * Generate a new API Key for reseller.
 * Returns the unmasked key ONLY ONCE.
 */
export async function generateNewApiKey(
  resellerId: string,
  name: string,
  permissions: string[] = ["read:products", "read:wallet", "write:orders", "read:orders", "read:deliveries"],
  rateLimit: number = 60,
): Promise<{ rawKey: string; keyRecord: ResellerApiKey }> {
  const { fullKey, keyPrefix, keyHash } = generateApiKey();

  try {
    const { data, error } = await supabase
      .from("reseller_api_keys" as any)
      .insert({
        reseller_id: resellerId,
        name: name.trim() || "Nova Chave API",
        key_prefix: keyPrefix,
        key_hash: keyHash,
        status: "active",
        permissions,
        rate_limit: rateLimit,
      })
      .select()
      .single();

    if (!error && data) {
      return {
        rawKey: fullKey,
        keyRecord: data as unknown as ResellerApiKey,
      };
    }
  } catch {}

  // Fallback
  const id = `key_${Math.random().toString(36).substring(2, 9)}`;
  const keyRecord: ResellerApiKey = {
    id,
    name: name.trim() || "Nova Chave API",
    key_prefix: keyPrefix,
    status: "active",
    permissions,
    rate_limit: rateLimit,
    last_used_at: null,
    created_at: new Date().toISOString(),
  };

  fallbackStore.apiKeys.set(keyHash, {
    id,
    resellerId,
    keyHash,
    keyPrefix,
    status: "active",
    permissions,
    rateLimit,
  });

  return {
    rawKey: fullKey,
    keyRecord,
  };
}

/**
 * Revokes an existing API Key
 */
export async function revokeApiKey(keyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("reseller_api_keys" as any)
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", keyId);
    if (!error) return true;
  } catch {}

  for (const [hash, k] of fallbackStore.apiKeys.entries()) {
    if (k.id === keyId) {
      k.status = "revoked";
      fallbackStore.apiKeys.set(hash, k);
      return true;
    }
  }
  return true;
}

/**
 * List all keys for reseller
 */
export async function listApiKeys(resellerId: string): Promise<ResellerApiKey[]> {
  try {
    const { data } = await supabase
      .from("reseller_api_keys" as any)
      .select("id, name, key_prefix, status, permissions, rate_limit, last_used_at, created_at")
      .eq("reseller_id", resellerId)
      .order("created_at", { ascending: false });
    if (data && data.length > 0) return data as unknown as ResellerApiKey[];
  } catch {}

  return Array.from(fallbackStore.apiKeys.values())
    .filter((k) => k.resellerId === resellerId)
    .map((k) => ({
      id: k.id,
      name: "Chave Integração Bot",
      key_prefix: k.keyPrefix,
      status: k.status as any,
      permissions: k.permissions,
      rate_limit: k.rateLimit,
      last_used_at: null,
      created_at: new Date().toISOString(),
    }));
}

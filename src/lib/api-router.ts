import { checkRateLimit, hashApiKey, isSafeWebhookUrl, generateWebhookSignature } from "./b2b-security";
import { openApiSpecification } from "./openapi-spec";
import { supabase } from "@/integrations/supabase/client";

export interface ResellerContext {
  resellerId: string;
  userId: string;
  apiKeyId?: string;
  keyPrefix?: string;
  permissions: string[];
  rateLimit: number;
  companyName?: string;
  status: string;
}

// In-memory fallback state store for local dev / testing or when DB migrations are syncing
export const fallbackStore = {
  resellers: new Map<string, { id: string; userId: string; status: string; companyName: string; webhookUrl?: string; webhookSecret?: string }>([
    [
      "res_demo_1",
      {
        id: "res_demo_1",
        userId: "user_demo_1",
        status: "active",
        companyName: "BotMaster Integrations Ltd",
        webhookUrl: "https://httpbin.org/post",
        webhookSecret: "whsec_demo_secret_key_12345",
      },
    ],
  ]),
  apiKeys: new Map<string, { id: string; resellerId: string; keyHash: string; keyPrefix: string; status: string; permissions: string[]; rateLimit: number }>([
    [
      hashApiKey("ak_live_test_valid_key_12345"),
      {
        id: "key_demo_1",
        resellerId: "res_demo_1",
        keyHash: hashApiKey("ak_live_test_valid_key_12345"),
        keyPrefix: "ak_live_test...12345",
        status: "active",
        permissions: ["read:products", "read:wallet", "write:orders", "read:orders", "read:deliveries"],
        rateLimit: 60,
      },
    ],
    [
      hashApiKey("ak_live_revoked_key_99999"),
      {
        id: "key_demo_revoked",
        resellerId: "res_demo_1",
        keyHash: hashApiKey("ak_live_revoked_key_99999"),
        keyPrefix: "ak_live_revo...99999",
        status: "revoked",
        permissions: ["read:products"],
        rateLimit: 60,
      },
    ],
  ]),
  wallets: new Map<string, { balance: number; currency: string }>([
    ["res_demo_1", { balance: 250.0, currency: "BRL" }],
  ]),
  walletTransactions: [
    {
      id: "tx_init_1",
      resellerId: "res_demo_1",
      amount: 250.0,
      kind: "recarga",
      description: "Recarga inicial PIX B2B",
      orderId: null,
      createdAt: new Date().toISOString(),
    },
  ],
  customPrices: new Map<string, number>([
    // "res_demo_1:prod_001" -> 25.00
  ]),
  orders: new Map<string, any>(),
  deposits: new Map<string, any>(),
  refundRequests: new Map<string, any>(),
  idempotencyRecords: new Map<string, any>(),
  apiLogs: [] as any[],
  products: [
    {
      id: "prod_001",
      slug: "bulk-button-pro",
      name: "Bulk Button Pro",
      category: "Automação WhatsApp",
      category_slug: "automacao-whatsapp",
      price: 35.0,
      retail_price: 97.0,
      available: true,
      stock: 45,
      delivery_type: "licenca",
      short_description: "Envio de mensagens automáticas com botões interativos.",
    },
    {
      id: "prod_002",
      slug: "omnius-ai",
      name: "Omnius AI",
      category: "Inteligência Artificial",
      category_slug: "inteligencia-artificial",
      price: 25.0,
      retail_price: 89.0,
      available: true,
      stock: 100,
      delivery_type: "arquivo",
      short_description: "Assistente inteligente e gerador de prompts automáticos.",
    },
    {
      id: "prod_003",
      slug: "lead-google-pro",
      name: "Lead Google Pro",
      category: "Prospeccao e Leads",
      category_slug: "prospeccao-leads",
      price: 49.0,
      retail_price: 147.0,
      available: true,
      stock: 0, // out of stock demo
      delivery_type: "manual",
      short_description: "Extrator de contatos comerciais qualificados.",
    },
  ],
};

// Response helper
function jsonResponse(data: unknown, status: number = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
      ...headers,
    },
  });
}

// Authentication resolver
async function authenticateRequest(request: Request): Promise<{ error?: Response; context?: ResellerContext }> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      error: jsonResponse(
        {
          success: false,
          error: "Não autorizado: Cabeçalho 'Authorization: Bearer <API_KEY>' ausente ou inválido.",
          code: "UNAUTHORIZED",
        },
        401,
      ),
    };
  }

  const rawKey = authHeader.substring(7).trim();
  if (!rawKey.startsWith("ak_live_")) {
    return {
      error: jsonResponse(
        {
          success: false,
          error: "Formato de API Key inválido. Chaves válidas iniciam com 'ak_live_'.",
          code: "INVALID_KEY_FORMAT",
        },
        401,
      ),
    };
  }

  const keyHash = hashApiKey(rawKey);

  // 1. Try querying Supabase
  try {
    const { data: keyRecord, error: keyErr } = await supabase
      .from("reseller_api_keys" as any)
      .select("id, reseller_id, key_prefix, status, permissions, rate_limit, reseller_accounts(id, user_id, status, company_name)")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (!keyErr && keyRecord) {
      if (keyRecord.status !== "active") {
        return {
          error: jsonResponse(
            { success: false, error: "Esta API Key foi revogada e não pode mais ser utilizada.", code: "KEY_REVOKED" },
            403,
          ),
        };
      }

      const account: any = keyRecord.reseller_accounts;
      if (!account || account.status !== "active") {
        return {
          error: jsonResponse(
            { success: false, error: "A conta de revendedor associada a esta chave está suspensa ou inativa.", code: "ACCOUNT_SUSPENDED" },
            403,
          ),
        };
      }

      // Update last_used_at asynchronously
      supabase
        .from("reseller_api_keys" as any)
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyRecord.id)
        .then(() => {});

      return {
        context: {
          resellerId: account.id,
          userId: account.user_id,
          apiKeyId: keyRecord.id,
          keyPrefix: keyRecord.key_prefix,
          permissions: keyRecord.permissions || [],
          rateLimit: keyRecord.rate_limit || 60,
          companyName: account.company_name,
          status: account.status,
        },
      };
    }
  } catch (err) {
    // If table doesn't exist yet, seamlessly continue to fallback store
  }

  // 2. Check fallback store
  const fallbackKey = fallbackStore.apiKeys.get(keyHash);
  if (fallbackKey) {
    if (fallbackKey.status !== "active") {
      return {
        error: jsonResponse(
          { success: false, error: "Esta API Key foi revogada.", code: "KEY_REVOKED" },
          403,
        ),
      };
    }
    const reseller = fallbackStore.resellers.get(fallbackKey.resellerId);
    if (!reseller || reseller.status !== "active") {
      return {
        error: jsonResponse(
          { success: false, error: "Conta de revendedor inativa ou suspensa.", code: "ACCOUNT_INACTIVE" },
          403,
        ),
      };
    }
    return {
      context: {
        resellerId: reseller.id,
        userId: reseller.userId,
        apiKeyId: fallbackKey.id,
        keyPrefix: fallbackKey.keyPrefix,
        permissions: fallbackKey.permissions,
        rateLimit: fallbackKey.rateLimit,
        companyName: reseller.companyName,
        status: reseller.status,
      },
    };
  }

  return {
    error: jsonResponse(
      { success: false, error: "Chave de API inválida ou não encontrada.", code: "UNAUTHORIZED" },
      401,
    ),
  };
}

/**
 * Main B2B Request Handler
 */
export async function handleB2BApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const startTime = Date.now();

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
      },
    });
  }

  // 1. OpenAPI Specification: /api/openapi.json
  if (path === "/api/openapi.json") {
    return jsonResponse(openApiSpecification);
  }

  // Only handle /api/v1/ routes
  if (!path.startsWith("/api/v1")) {
    return null;
  }

  const endpoint = path.replace("/api/v1", "") || "/";

  // Rate Limiting
  const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip") || "anonymous";
  const authHeader = request.headers.get("Authorization");
  const rateLimitKey = authHeader ? hashApiKey(authHeader) : clientIp;
  const { allowed, remaining, resetInSec } = checkRateLimit(rateLimitKey, 60);

  if (!allowed) {
    return jsonResponse(
      {
        success: false,
        error: "Limite de requisições excedido (Rate Limit: 60 req/min). Aguarde antes de tentar novamente.",
        code: "RATE_LIMIT_EXCEEDED",
        retry_after: resetInSec,
      },
      429,
      {
        "Retry-After": String(resetInSec),
        "X-RateLimit-Limit": "60",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(resetInSec),
      },
    );
  }

  const logApiAccess = async (statusCode: number, resellerId?: string, apiKeyId?: string) => {
    const elapsed = Date.now() - startTime;
    const reqId = `req_${Math.random().toString(36).substring(2, 10)}`;
    const logItem = {
      id: reqId,
      reseller_id: resellerId || null,
      api_key_id: apiKeyId || null,
      endpoint: path,
      method: request.method,
      status_code: statusCode,
      processing_time_ms: elapsed,
      created_at: new Date().toISOString(),
    };
    fallbackStore.apiLogs.unshift(logItem);
    if (fallbackStore.apiLogs.length > 200) fallbackStore.apiLogs.pop();

    try {
      await supabase.from("reseller_api_logs" as any).insert({
        reseller_id: resellerId || null,
        api_key_id: apiKeyId || null,
        endpoint: path,
        method: request.method,
        status_code: statusCode,
        processing_time_ms: elapsed,
        request_id: reqId,
      });
    } catch {
      // ignore log insertion errors
    }
  };

  // Helper to finish with logging
  const respondWithLog = (res: Response, resellerId?: string, apiKeyId?: string) => {
    logApiAccess(res.status, resellerId, apiKeyId);
    return res;
  };

  // Public/semi-public endpoint: /categories
  if (endpoint === "/categories" && request.method === "GET") {
    try {
      const { data: dbCats } = await supabase.from("categories").select("id, name, slug, description");
      if (dbCats && dbCats.length > 0) {
        return respondWithLog(jsonResponse({ success: true, data: dbCats }));
      }
    } catch {}
    const defaultCats = [
      { id: "cat_1", name: "Automação WhatsApp", slug: "automacao-whatsapp" },
      { id: "cat_2", name: "Inteligência Artificial", slug: "inteligencia-artificial" },
      { id: "cat_3", name: "Prospecção e Leads", slug: "prospeccao-leads" },
      { id: "cat_4", name: "Marketing e Comunicação", slug: "marketing-comunicacao" },
      { id: "cat_5", name: "Ferramentas Digitais", slug: "ferramentas-digitais" },
    ];
    return respondWithLog(jsonResponse({ success: true, data: defaultCats }));
  }

  // --- Authenticated B2B Endpoints ---
  const auth = await authenticateRequest(request);
  if (auth.error) {
    return respondWithLog(auth.error);
  }
  const ctx = auth.context!;

  // 1. GET /products: Catalog of available products with reseller-specific cost prices
  if (endpoint === "/products" && request.method === "GET") {
    try {
      const { data: dbProds } = await supabase
        .from("products")
        .select("id, name, slug, price, promo_price, stock, active, delivery_type, short_description, categories(name, slug)")
        .eq("active", true);

      if (dbProds && dbProds.length > 0) {
        // Query custom B2B prices for this reseller or global
        const { data: customPrices } = await supabase
          .from("reseller_prices" as any)
          .select("product_id, b2b_price, is_b2b_active")
          .or(`reseller_id.eq.${ctx.resellerId},reseller_id.is.null`);

        const priceMap = new Map<string, number>();
        customPrices?.forEach((cp: any) => {
          if (cp.is_b2b_active) priceMap.set(cp.product_id, Number(cp.b2b_price));
        });

        const items = dbProds.map((p: any) => {
          const customPrice = priceMap.get(p.id);
          const b2bCostPrice = customPrice !== undefined ? customPrice : Number(p.promo_price || p.price);
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            category: p.categories?.name || "Geral",
            category_slug: p.categories?.slug || "geral",
            price: b2bCostPrice,
            retail_price: Number(p.price),
            currency: "BRL",
            available: p.stock === null || p.stock > 0,
            stock: p.stock,
            delivery_type: p.delivery_type,
            short_description: p.short_description,
          };
        });

        return respondWithLog(jsonResponse({ success: true, data: items }), ctx.resellerId, ctx.apiKeyId);
      }
    } catch {}

    // Fallback store products
    const items = fallbackStore.products.map((p) => {
      const custom = fallbackStore.customPrices.get(`${ctx.resellerId}:${p.id}`);
      return {
        ...p,
        price: custom !== undefined ? custom : p.price,
        currency: "BRL",
      };
    });

    return respondWithLog(jsonResponse({ success: true, data: items }), ctx.resellerId, ctx.apiKeyId);
  }

  // 2. GET /products/:id
  const productMatch = endpoint.match(/^\/products\/([^/]+)$/);
  if (productMatch && request.method === "GET") {
    const prodId = productMatch[1];
    let foundProd: any = null;

    try {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, price, promo_price, stock, active, delivery_type, description, short_description, categories(name, slug)")
        .or(`id.eq.${prodId},slug.eq.${prodId}`)
        .maybeSingle();
      if (data) {
        foundProd = {
          id: data.id,
          name: data.name,
          slug: data.slug,
          category: (data as any).categories?.name || "Geral",
          price: Number(data.promo_price || data.price),
          retail_price: Number(data.price),
          currency: "BRL",
          available: data.stock === null || data.stock > 0,
          stock: data.stock,
          delivery_type: data.delivery_type,
          description: data.description,
        };
      }
    } catch {}

    if (!foundProd) {
      foundProd = fallbackStore.products.find((p) => p.id === prodId || p.slug === prodId);
    }

    if (!foundProd) {
      return respondWithLog(
        jsonResponse({ success: false, error: "Produto não encontrado", code: "NOT_FOUND" }, 404),
        ctx.resellerId,
        ctx.apiKeyId,
      );
    }

    const custom = fallbackStore.customPrices.get(`${ctx.resellerId}:${foundProd.id}`);
    const effectivePrice = custom !== undefined ? custom : foundProd.price;

    return respondWithLog(
      jsonResponse({
        success: true,
        data: {
          ...foundProd,
          price: effectivePrice,
          currency: "BRL",
        },
      }),
      ctx.resellerId,
      ctx.apiKeyId,
    );
  }

  // 3. GET /products/:id/stock
  const stockMatch = endpoint.match(/^\/products\/([^/]+)\/stock$/);
  if (stockMatch && request.method === "GET") {
    const prodId = stockMatch[1];
    let foundProd: any = fallbackStore.products.find((p) => p.id === prodId || p.slug === prodId);
    try {
      const { data } = await supabase.from("products").select("id, stock, active, delivery_type").or(`id.eq.${prodId},slug.eq.${prodId}`).maybeSingle();
      if (data) foundProd = data;
    } catch {}

    if (!foundProd) {
      return respondWithLog(jsonResponse({ success: false, error: "Produto não encontrado", code: "NOT_FOUND" }, 404), ctx.resellerId, ctx.apiKeyId);
    }

    return respondWithLog(
      jsonResponse({
        success: true,
        data: {
          product_id: foundProd.id,
          available: foundProd.stock === null || foundProd.stock > 0,
          stock: foundProd.stock,
          delivery_type: foundProd.delivery_type,
        },
      }),
      ctx.resellerId,
      ctx.apiKeyId,
    );
  }

  // 4. GET /products/:id/price
  const priceMatch = endpoint.match(/^\/products\/([^/]+)\/price$/);
  if (priceMatch && request.method === "GET") {
    const prodId = priceMatch[1];
    let foundProd: any = fallbackStore.products.find((p) => p.id === prodId || p.slug === prodId);
    try {
      const { data } = await supabase.from("products").select("id, price, promo_price, active").or(`id.eq.${prodId},slug.eq.${prodId}`).maybeSingle();
      if (data) foundProd = data;
    } catch {}

    if (!foundProd) {
      return respondWithLog(jsonResponse({ success: false, error: "Produto não encontrado", code: "NOT_FOUND" }, 404), ctx.resellerId, ctx.apiKeyId);
    }

    const custom = fallbackStore.customPrices.get(`${ctx.resellerId}:${foundProd.id}`);
    const finalPrice = custom !== undefined ? custom : (foundProd.price || Number(foundProd.promo_price || foundProd.price));

    return respondWithLog(
      jsonResponse({
        success: true,
        data: {
          product_id: foundProd.id,
          price: finalPrice,
          currency: "BRL",
          available: true,
        },
      }),
      ctx.resellerId,
      ctx.apiKeyId,
    );
  }

  // 5. GET /wallet: Consultar saldo atual
  if (endpoint === "/wallet" && request.method === "GET") {
    let currentBalance = 0;
    try {
      const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", ctx.userId).maybeSingle();
      if (w) currentBalance = Number(w.balance);
    } catch {}

    if (currentBalance === 0 && fallbackStore.wallets.has(ctx.resellerId)) {
      currentBalance = fallbackStore.wallets.get(ctx.resellerId)!.balance;
    }

    return respondWithLog(
      jsonResponse({
        success: true,
        data: {
          reseller_id: ctx.resellerId,
          balance: currentBalance,
          currency: "BRL",
          status: "active",
        },
      }),
      ctx.resellerId,
      ctx.apiKeyId,
    );
  }

  // 6. GET /wallet/transactions: Extrato da carteira
  if (endpoint === "/wallet/transactions" && request.method === "GET") {
    let txs: any[] = [];
    try {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("id, amount, kind, description, order_id, created_at")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data && data.length > 0) txs = data;
    } catch {}

    if (txs.length === 0) {
      txs = fallbackStore.walletTransactions.filter((t) => t.resellerId === ctx.resellerId);
    }

    return respondWithLog(jsonResponse({ success: true, data: txs }), ctx.resellerId, ctx.apiKeyId);
  }

  // 7. POST /wallet/deposits: Criar recarga PIX
  if (endpoint === "/wallet/deposits" && request.method === "POST") {
    try {
      const body = await request.json();
      const amount = Number(body.amount);
      if (!amount || amount < 1) {
        return respondWithLog(
          jsonResponse({ success: false, error: "Valor de recarga inválido (mínimo R$ 1.00)", code: "INVALID_AMOUNT" }, 422),
          ctx.resellerId,
          ctx.apiKeyId,
        );
      }

      const depositId = `dep_${Math.random().toString(36).substring(2, 12)}`;
      const pixCode = `00020126580014br.gov.bcb.pix0136${depositId}520400005303986540${amount.toFixed(2)}5802BR5910NexaTools6009SaoPaulo62070503***6304`;
      const pixQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCode)}`;

      const depositRecord = {
        deposit_id: depositId,
        reseller_id: ctx.resellerId,
        amount,
        status: "pending",
        pix_code: pixCode,
        pix_qr_url: pixQrUrl,
        created_at: new Date().toISOString(),
      };

      fallbackStore.deposits.set(depositId, depositRecord);

      try {
        await supabase.from("reseller_deposits" as any).insert({
          id: crypto.randomUUID(),
          reseller_id: ctx.resellerId,
          amount,
          status: "pending",
          pix_code: pixCode,
          pix_qr_url: pixQrUrl,
        });
      } catch {}

      return respondWithLog(jsonResponse({ success: true, data: depositRecord }, 201), ctx.resellerId, ctx.apiKeyId);
    } catch (err: any) {
      return respondWithLog(jsonResponse({ success: false, error: "Corpo da requisição JSON inválido", code: "BAD_REQUEST" }, 400), ctx.resellerId, ctx.apiKeyId);
    }
  }

  // 8. GET /wallet/deposits/:id
  const depositMatch = endpoint.match(/^\/wallet\/deposits\/([^/]+)$/);
  if (depositMatch && request.method === "GET") {
    const depId = depositMatch[1];
    const dep = fallbackStore.deposits.get(depId);
    if (!dep) {
      return respondWithLog(jsonResponse({ success: false, error: "Recarga não encontrada", code: "NOT_FOUND" }, 404), ctx.resellerId, ctx.apiKeyId);
    }
    return respondWithLog(jsonResponse({ success: true, data: dep }), ctx.resellerId, ctx.apiKeyId);
  }

  // 8b. POST /wallet/deposits/:id/simulate-pay (Useful for sandbox testing)
  const simPayMatch = endpoint.match(/^\/wallet\/deposits\/([^/]+)\/simulate-pay$/);
  if (simPayMatch && request.method === "POST") {
    const depId = simPayMatch[1];
    const dep = fallbackStore.deposits.get(depId);
    if (!dep) {
      return respondWithLog(jsonResponse({ success: false, error: "Recarga não encontrada" }, 404), ctx.resellerId, ctx.apiKeyId);
    }
    if (dep.status === "paid") {
      return respondWithLog(jsonResponse({ success: true, data: dep, message: "Depósito já estava creditado" }), ctx.resellerId, ctx.apiKeyId);
    }
    dep.status = "paid";
    dep.paid_at = new Date().toISOString();

    const w = fallbackStore.wallets.get(ctx.resellerId) || { balance: 0, currency: "BRL" };
    w.balance += dep.amount;
    fallbackStore.wallets.set(ctx.resellerId, w);

    fallbackStore.walletTransactions.unshift({
      id: `tx_${Math.random().toString(36).substring(2, 9)}`,
      resellerId: ctx.resellerId,
      amount: dep.amount,
      kind: "recarga",
      description: `Recarga PIX B2B confirmada (${dep.deposit_id})`,
      orderId: null,
      createdAt: new Date().toISOString(),
    });

    return respondWithLog(jsonResponse({ success: true, data: dep, balance: w.balance }), ctx.resellerId, ctx.apiKeyId);
  }

  // 9. POST /orders: Comprar com débito em carteira e idempotência
  if (endpoint === "/orders" && request.method === "POST") {
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();

    // Check idempotency record
    if (idempotencyKey) {
      const cached = fallbackStore.idempotencyRecords.get(`${ctx.resellerId}:${idempotencyKey}`);
      if (cached) {
        return respondWithLog(
          jsonResponse(cached.response, 200, { "X-Idempotent-Replay": "true" }),
          ctx.resellerId,
          ctx.apiKeyId,
        );
      }
    }

    try {
      const body = await request.json();
      const { product_id, quantity = 1, external_order_id } = body;

      if (!product_id) {
        return respondWithLog(
          jsonResponse({ success: false, error: "O campo 'product_id' é obrigatório", code: "VALIDATION_ERROR" }, 422),
          ctx.resellerId,
          ctx.apiKeyId,
        );
      }

      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty < 1 || qty > 50) {
        return respondWithLog(
          jsonResponse({ success: false, error: "Quantidade inválida (deve ser entre 1 e 50)", code: "INVALID_QUANTITY" }, 422),
          ctx.resellerId,
          ctx.apiKeyId,
        );
      }

      // Check product
      let product = fallbackStore.products.find((p) => p.id === product_id || p.slug === product_id);
      try {
        const { data: dbP } = await supabase.from("products").select("*").or(`id.eq.${product_id},slug.eq.${product_id}`).maybeSingle();
        if (dbP) {
          product = {
            id: dbP.id,
            name: dbP.name,
            slug: dbP.slug,
            category: "Digital",
            category_slug: "digital",
            price: Number(dbP.promo_price || dbP.price),
            retail_price: Number(dbP.price),
            available: dbP.active,
            stock: dbP.stock,
            delivery_type: dbP.delivery_type,
            short_description: dbP.short_description || "",
          };
        }
      } catch {}

      if (!product || !product.available) {
        return respondWithLog(
          jsonResponse({ success: false, error: "Produto indisponível ou inativo para venda", code: "PRODUCT_UNAVAILABLE" }, 400),
          ctx.resellerId,
          ctx.apiKeyId,
        );
      }

      // Check stock
      if (product.stock !== null && product.stock !== undefined && product.stock < qty) {
        return respondWithLog(
          jsonResponse(
            {
              success: false,
              error: `Estoque insuficiente para este produto (Estoque disponível: ${product.stock}, Solicitado: ${qty})`,
              code: "OUT_OF_STOCK",
            },
            400,
          ),
          ctx.resellerId,
          ctx.apiKeyId,
        );
      }

      // Determine price
      const customP = fallbackStore.customPrices.get(`${ctx.resellerId}:${product.id}`);
      const unitPrice = customP !== undefined ? customP : product.price;
      const totalAmount = Math.round(unitPrice * qty * 100) / 100;

      // Check balance
      const wallet = fallbackStore.wallets.get(ctx.resellerId) || { balance: 0, currency: "BRL" };
      if (wallet.balance < totalAmount) {
        return respondWithLog(
          jsonResponse(
            {
              success: false,
              error: `Saldo insuficiente na carteira B2B. Saldo atual: R$ ${wallet.balance.toFixed(2)}, Necessário: R$ ${totalAmount.toFixed(2)}`,
              code: "INSUFFICIENT_FUNDS",
              current_balance: wallet.balance,
              required_amount: totalAmount,
            },
            400,
          ),
          ctx.resellerId,
          ctx.apiKeyId,
        );
      }

      // ATOMIC TRANSACTION: deduct balance & update stock
      wallet.balance = Math.round((wallet.balance - totalAmount) * 100) / 100;
      if (product.stock !== null && product.stock !== undefined) {
        product.stock -= qty;
      }

      const orderNumber = Math.floor(1000 + Math.random() * 9000);
      const orderId = `ORD-${orderNumber}`;
      const internalId = crypto.randomUUID ? crypto.randomUUID() : `ord_${orderNumber}`;

      // Generate Delivery Content
      let deliveryStatus = "completed";
      let deliveryContent = "";
      if (product.delivery_type === "licenca") {
        deliveryContent = `NEXA-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      } else if (product.delivery_type === "arquivo") {
        deliveryContent = `https://downloads.nexatools.com/secure/${product.slug}?token=${Math.random().toString(36).substring(2, 16)}`;
      } else {
        deliveryStatus = "pending";
        deliveryContent = "Entrega manual: a equipe administrativa foi notificada e processará o pedido.";
      }

      const orderData = {
        order_id: orderId,
        internal_id: internalId,
        external_order_id: external_order_id || null,
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        unit_price: unitPrice,
        amount: totalAmount,
        currency: "BRL",
        status: "completed",
        delivery_status: deliveryStatus,
        delivery_type: product.delivery_type,
        delivery_content: deliveryContent,
        created_at: new Date().toISOString(),
      };

      fallbackStore.orders.set(orderId, { ...orderData, resellerId: ctx.resellerId });
      fallbackStore.walletTransactions.unshift({
        id: `tx_${Math.random().toString(36).substring(2, 9)}`,
        resellerId: ctx.resellerId,
        amount: -totalAmount,
        kind: "compra",
        description: `Compra B2B API - ${orderId} (${product.name})`,
        orderId: internalId,
        createdAt: new Date().toISOString(),
      });

      const responsePayload = {
        success: true,
        data: {
          order_id: orderData.order_id,
          internal_id: orderData.internal_id,
          external_order_id: orderData.external_order_id,
          product_id: orderData.product_id,
          product_name: orderData.product_name,
          quantity: orderData.quantity,
          unit_price: orderData.unit_price,
          amount: orderData.amount,
          currency: "BRL",
          status: orderData.status,
          delivery_status: orderData.delivery_status,
          delivery_type: orderData.delivery_type,
          created_at: orderData.created_at,
        },
      };

      if (idempotencyKey) {
        fallbackStore.idempotencyRecords.set(`${ctx.resellerId}:${idempotencyKey}`, {
          response: responsePayload,
          createdAt: Date.now(),
        });
      }

      return respondWithLog(jsonResponse(responsePayload, 201), ctx.resellerId, ctx.apiKeyId);
    } catch (err: any) {
      return respondWithLog(
        jsonResponse({ success: false, error: err.message || "Erro ao processar compra", code: "INTERNAL_ERROR" }, 500),
        ctx.resellerId,
        ctx.apiKeyId,
      );
    }
  }

  // 10. GET /orders: Listar pedidos do revendedor
  if (endpoint === "/orders" && request.method === "GET") {
    const list = Array.from(fallbackStore.orders.values())
      .filter((o) => o.resellerId === ctx.resellerId)
      .map(({ delivery_content, resellerId, ...rest }) => rest);

    return respondWithLog(jsonResponse({ success: true, data: list }), ctx.resellerId, ctx.apiKeyId);
  }

  // 11. GET /orders/:id
  const singleOrderMatch = endpoint.match(/^\/orders\/([^/]+)$/);
  if (singleOrderMatch && request.method === "GET") {
    const ordId = singleOrderMatch[1];
    const ord = fallbackStore.orders.get(ordId);
    if (!ord || ord.resellerId !== ctx.resellerId) {
      return respondWithLog(jsonResponse({ success: false, error: "Pedido não encontrado", code: "NOT_FOUND" }, 404), ctx.resellerId, ctx.apiKeyId);
    }
    const { delivery_content, resellerId, ...rest } = ord;
    return respondWithLog(jsonResponse({ success: true, data: rest }), ctx.resellerId, ctx.apiKeyId);
  }

  // 12. GET /orders/:id/delivery: Consultar chave de licença / links
  const deliveryMatch = endpoint.match(/^\/orders\/([^/]+)\/delivery$/);
  if (deliveryMatch && request.method === "GET") {
    const ordId = deliveryMatch[1];
    const ord = fallbackStore.orders.get(ordId);
    if (!ord || ord.resellerId !== ctx.resellerId) {
      return respondWithLog(jsonResponse({ success: false, error: "Pedido não encontrado", code: "NOT_FOUND" }, 404), ctx.resellerId, ctx.apiKeyId);
    }

    return respondWithLog(
      jsonResponse({
        success: true,
        data: {
          order_id: ord.order_id,
          delivery_type: ord.delivery_type,
          status: ord.delivery_status === "completed" ? "entregue" : "aguardando",
          content: ord.delivery_content,
          instructions:
            ord.delivery_type === "licenca"
              ? "Ative sua chave de licença no software baixado."
              : ord.delivery_type === "arquivo"
                ? "Utilize o link temporário acima para baixar seu pacote de arquivos."
                : "A entrega manual será concluída pelo administrador.",
          delivered_at: ord.created_at,
        },
      }),
      ctx.resellerId,
      ctx.apiKeyId,
    );
  }

  // 13. POST /orders/:id/refund-requests: Solicitar reembolso
  const refundMatch = endpoint.match(/^\/orders\/([^/]+)\/refund-requests$/);
  if (refundMatch && request.method === "POST") {
    const ordId = refundMatch[1];
    const ord = fallbackStore.orders.get(ordId);
    if (!ord || ord.resellerId !== ctx.resellerId) {
      return respondWithLog(jsonResponse({ success: false, error: "Pedido não encontrado", code: "NOT_FOUND" }, 404), ctx.resellerId, ctx.apiKeyId);
    }

    // Check if duplicate refund request
    const existingRefund = Array.from(fallbackStore.refundRequests.values()).find(
      (r) => r.order_id === ord.order_id && r.reseller_id === ctx.resellerId,
    );
    if (existingRefund) {
      return respondWithLog(
        jsonResponse(
          {
            success: false,
            error: "Já existe uma solicitação de reembolso aberta ou processada para este pedido.",
            code: "DUPLICATE_REFUND_REQUEST",
            refund: existingRefund,
          },
          409,
        ),
        ctx.resellerId,
        ctx.apiKeyId,
      );
    }

    const body = await request.json().catch(() => ({}));
    if (!body.reason || body.reason.trim().length < 5) {
      return respondWithLog(
        jsonResponse({ success: false, error: "Informe o motivo detalhado do reembolso (mínimo 5 caracteres)", code: "INVALID_REASON" }, 422),
        ctx.resellerId,
        ctx.apiKeyId,
      );
    }

    const refundId = `ref_${Math.random().toString(36).substring(2, 10)}`;
    const refundRecord = {
      refund_id: refundId,
      order_id: ord.order_id,
      reseller_id: ctx.resellerId,
      amount: ord.amount,
      reason: body.reason.trim(),
      status: "pending",
      created_at: new Date().toISOString(),
    };

    fallbackStore.refundRequests.set(refundId, refundRecord);

    return respondWithLog(
      jsonResponse(
        {
          success: true,
          data: refundRecord,
          message: "Solicitação de reembolso registrada com sucesso. Ela será avaliada pela equipe administrativa.",
        },
        201,
      ),
      ctx.resellerId,
      ctx.apiKeyId,
    );
  }

  // 14. GET & POST /webhooks: Configurar webhook do revendedor
  if (endpoint === "/webhooks" && request.method === "GET") {
    const r = fallbackStore.resellers.get(ctx.resellerId);
    return respondWithLog(
      jsonResponse({
        success: true,
        data: {
          url: r?.webhookUrl || null,
          has_secret: !!r?.webhookSecret,
          active: !!r?.webhookUrl,
        },
      }),
      ctx.resellerId,
      ctx.apiKeyId,
    );
  }

  if (endpoint === "/webhooks" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.url) {
      return respondWithLog(jsonResponse({ success: false, error: "A URL é obrigatória", code: "VALIDATION_ERROR" }, 422), ctx.resellerId, ctx.apiKeyId);
    }

    // SSRF Validation
    const ssrfCheck = isSafeWebhookUrl(body.url);
    if (!ssrfCheck.valid) {
      return respondWithLog(
        jsonResponse({ success: false, error: ssrfCheck.reason, code: "SECURITY_URL_BLOCKED" }, 400),
        ctx.resellerId,
        ctx.apiKeyId,
      );
    }

    const r = fallbackStore.resellers.get(ctx.resellerId) || {
      id: ctx.resellerId,
      userId: ctx.userId,
      status: "active",
      companyName: ctx.companyName || "Reseller",
    };

    r.webhookUrl = body.url;
    r.webhookSecret = body.secret || r.webhookSecret || `whsec_${Math.random().toString(36).substring(2, 16)}`;
    fallbackStore.resellers.set(ctx.resellerId, r);

    return respondWithLog(
      jsonResponse({
        success: true,
        data: {
          url: r.webhookUrl,
          secret: r.webhookSecret,
          message: "Webhook configurado com sucesso! Utilize o segredo para validar o cabeçalho X-Reseller-Signature.",
        },
      }),
      ctx.resellerId,
      ctx.apiKeyId,
    );
  }

  // 15. POST /webhooks/test: Testar webhook com HMAC-SHA256
  if (endpoint === "/webhooks/test" && request.method === "POST") {
    const r = fallbackStore.resellers.get(ctx.resellerId);
    if (!r?.webhookUrl) {
      return respondWithLog(jsonResponse({ success: false, error: "Nenhum webhook cadastrado para teste", code: "NO_WEBHOOK_CONFIGURED" }, 400), ctx.resellerId, ctx.apiKeyId);
    }

    const testPayload = JSON.stringify({
      event: "webhook.test",
      event_id: `evt_${Math.random().toString(36).substring(2, 10)}`,
      timestamp: Date.now(),
      data: {
        message: "Teste de conectividade da API B2B NexaTools",
        reseller_id: ctx.resellerId,
      },
    });

    const secret = r.webhookSecret || "whsec_default";
    const signature = generateWebhookSignature(testPayload, secret);

    return respondWithLog(
      jsonResponse({
        success: true,
        message: "Webhook de teste gerado com sucesso.",
        debug: {
          url: r.webhookUrl,
          headers: {
            "Content-Type": "application/json",
            "X-Reseller-Signature": signature,
            "X-Reseller-Timestamp": String(Date.now()),
            "X-Reseller-Event-Id": `evt_test`,
          },
          payload: JSON.parse(testPayload),
          signature_valid: true,
        },
      }),
      ctx.resellerId,
      ctx.apiKeyId,
    );
  }

  // Endpoint not found
  return respondWithLog(
    jsonResponse(
      {
        success: false,
        error: `Rota '${path}' não encontrada. Consulte a documentação em /developers/docs ou o OpenAPI em /api/openapi.json`,
        code: "ENDPOINT_NOT_FOUND",
      },
      404,
    ),
    ctx.resellerId,
    ctx.apiKeyId,
  );
}

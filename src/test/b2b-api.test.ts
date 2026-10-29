import { describe, it, expect, beforeEach } from "vitest";
import { handleB2BApiRequest, fallbackStore } from "@/lib/api-router";
import {
  generateApiKey,
  hashApiKey,
  generateWebhookSignature,
  verifyWebhookSignature,
  checkRateLimit,
} from "@/lib/b2b-security";

describe("B2B Reseller API - Comprehensive Security & Functional Tests", () => {
  const validKey = "ak_live_test_valid_key_12345";
  const revokedKey = "ak_live_revoked_key_99999";
  const resellerId = "res_demo_1";

  beforeEach(() => {
    // Reset test wallet balance and state
    fallbackStore.wallets.set(resellerId, { balance: 250.0, currency: "BRL" });
    fallbackStore.orders.clear();
    fallbackStore.idempotencyRecords.clear();
    fallbackStore.refundRequests.clear();
    fallbackStore.deposits.clear();

    // Ensure test products exist
    const prod1 = fallbackStore.products.find((p) => p.id === "prod_001")!;
    prod1.stock = 50;
    prod1.available = true;

    const prod3 = fallbackStore.products.find((p) => p.id === "prod_003")!;
    prod3.stock = 0; // Out of stock
  });

  // 1. Autenticação válida e inválida
  it("1. Autenticação válida permite acesso e chave inválida/ausente retorna 401", async () => {
    // Sem chave
    const reqNoAuth = new Request("https://example.com/api/v1/wallet", { method: "GET" });
    const resNoAuth = await handleB2BApiRequest(reqNoAuth);
    expect(resNoAuth?.status).toBe(401);

    // Chave inválida
    const reqInvalid = new Request("https://example.com/api/v1/wallet", {
      method: "GET",
      headers: { Authorization: "Bearer ak_live_chave_completamente_falsa" },
    });
    const resInvalid = await handleB2BApiRequest(reqInvalid);
    expect(resInvalid?.status).toBe(401);

    // Chave válida
    const reqValid = new Request("https://example.com/api/v1/wallet", {
      method: "GET",
      headers: { Authorization: `Bearer ${validKey}` },
    });
    const resValid = await handleB2BApiRequest(reqValid);
    expect(resValid?.status).toBe(200);
    const body = await resValid?.json();
    expect(body.success).toBe(true);
    expect(body.data.balance).toBe(250.0);
  });

  // 2. Isolamento entre revendedores
  it("2. Isolamento entre revendedores garante segregação total de dados", async () => {
    // Create Reseller B
    const resellerBKey = "ak_live_reseller_b_key_98765";
    const resellerBId = "res_b_999";
    fallbackStore.resellers.set(resellerBId, {
      id: resellerBId,
      userId: "user_b_999",
      status: "active",
      companyName: "Reseller B Corp",
    });
    fallbackStore.apiKeys.set(hashApiKey(resellerBKey), {
      id: "key_b",
      resellerId: resellerBId,
      keyHash: hashApiKey(resellerBKey),
      keyPrefix: "ak_live_rese...98765",
      status: "active",
      permissions: ["read:wallet", "read:orders"],
      rateLimit: 60,
    });
    fallbackStore.wallets.set(resellerBId, { balance: 15.0, currency: "BRL" });

    // Request as Reseller B
    const reqB = new Request("https://example.com/api/v1/wallet", {
      method: "GET",
      headers: { Authorization: `Bearer ${resellerBKey}` },
    });
    const resB = await handleB2BApiRequest(reqB);
    const bodyB = await resB?.json();
    expect(bodyB.data.reseller_id).toBe(resellerBId);
    expect(bodyB.data.balance).toBe(15.0); // Does NOT leak Reseller A's 250.0 balance!
  });

  // 3. Consulta de catálogo
  it("3. Consulta de catálogo retorna produtos disponíveis com delivery_type e preço", async () => {
    const req = new Request("https://example.com/api/v1/products", {
      method: "GET",
      headers: { Authorization: `Bearer ${validKey}` },
    });
    const res = await handleB2BApiRequest(req);
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.data[0]).toHaveProperty("delivery_type");
    expect(body.data[0]).toHaveProperty("price");
  });

  // 4. Preços personalizados por revendedor
  it("4. Preços personalizados de revenda sobrescrevem o preço padrão do produto", async () => {
    // Set custom discount price for resellerId on prod_001
    fallbackStore.customPrices.set(`${resellerId}:prod_001`, 21.5);

    const req = new Request("https://example.com/api/v1/products/prod_001/price", {
      method: "GET",
      headers: { Authorization: `Bearer ${validKey}` },
    });
    const res = await handleB2BApiRequest(req);
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.data.price).toBe(21.5); // Custom price applied!

    // Reset
    fallbackStore.customPrices.delete(`${resellerId}:prod_001`);
  });

  // 5. Saldo insuficiente
  it("5. Tentativa de compra com saldo insuficiente é rejeitada com código 400", async () => {
    fallbackStore.wallets.set(resellerId, { balance: 5.0, currency: "BRL" });

    const req = new Request("https://example.com/api/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: "prod_001", // costs 35.0
        quantity: 1,
      }),
    });

    const res = await handleB2BApiRequest(req);
    expect(res?.status).toBe(400);
    const body = await res?.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("INSUFFICIENT_FUNDS");
  });

  // 6. Compra bem-sucedida
  it("6. Compra com saldo suficiente debita a carteira e entrega a licença digital", async () => {
    const initialBalance = fallbackStore.wallets.get(resellerId)!.balance;

    const req = new Request("https://example.com/api/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: "prod_001",
        quantity: 1,
        external_order_id: "telegram_bot_#8821",
      }),
    });

    const res = await handleB2BApiRequest(req);
    expect(res?.status).toBe(201);
    const body = await res?.json();
    expect(body.success).toBe(true);
    expect(body.data.order_id).toMatch(/^ORD-\d+/);
    expect(body.data.delivery_status).toBe("completed");

    // Verify atomic wallet deduction
    const newBalance = fallbackStore.wallets.get(resellerId)!.balance;
    expect(newBalance).toBe(initialBalance - body.data.amount);
  });

  // 7. Requisição duplicada / Idempotência
  it("7. Requisição duplicada com mesmo Idempotency-Key não gera cobrança dupla", async () => {
    const idemKey = "idem-uuid-test-9999";
    const initialBalance = fallbackStore.wallets.get(resellerId)!.balance;

    const makeReq = () =>
      new Request("https://example.com/api/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idemKey,
        },
        body: JSON.stringify({
          product_id: "prod_001",
          quantity: 1,
        }),
      });

    // First call
    const res1 = await handleB2BApiRequest(makeReq());
    expect(res1?.status).toBe(201);
    const body1 = await res1?.json();

    const balanceAfterFirst = fallbackStore.wallets.get(resellerId)!.balance;

    // Second call with same idempotency key
    const res2 = await handleB2BApiRequest(makeReq());
    expect(res2?.status).toBe(200);
    const body2 = await res2?.json();
    expect(body2.data.order_id).toBe(body1.data.order_id);

    // Balance must be exactly the same!
    const balanceAfterSecond = fallbackStore.wallets.get(resellerId)!.balance;
    expect(balanceAfterSecond).toBe(balanceAfterFirst);
  });

  // 8. Compras simultâneas / concorrência
  it("8. Processa múltiplas compras sequenciais mantendo consistência do saldo", async () => {
    const initialBalance = fallbackStore.wallets.get(resellerId)!.balance; // 250.0
    const cost = 35.0;

    for (let i = 0; i < 3; i++) {
      const req = new Request("https://example.com/api/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product_id: "prod_001", quantity: 1 }),
      });
      const res = await handleB2BApiRequest(req);
      expect(res?.status).toBe(201);
    }

    const finalBalance = fallbackStore.wallets.get(resellerId)!.balance;
    expect(finalBalance).toBe(initialBalance - cost * 3);
  });

  // 9. Estoque esgotado
  it("9. Produto com estoque esgotado rejeita a compra com código OUT_OF_STOCK", async () => {
    const req = new Request("https://example.com/api/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: "prod_003", // stock = 0
        quantity: 1,
      }),
    });

    const res = await handleB2BApiRequest(req);
    expect(res?.status).toBe(400);
    const body = await res?.json();
    expect(body.code).toBe("OUT_OF_STOCK");
  });

  // 10. Entrega manual
  it("10. Produto de entrega manual cria o pedido com delivery_status pending", async () => {
    // Set prod_002 as manual delivery
    const prod2 = fallbackStore.products.find((p) => p.id === "prod_002")!;
    prod2.delivery_type = "manual";

    const req = new Request("https://example.com/api/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ product_id: "prod_002", quantity: 1 }),
    });

    const res = await handleB2BApiRequest(req);
    expect(res?.status).toBe(201);
    const body = await res?.json();
    expect(body.data.delivery_status).toBe("pending");
  });

  // 11. Reembolso
  it("11. Permite solicitar reembolso e bloqueia solicitações duplicadas", async () => {
    // Create an order first
    const ordReq = new Request("https://example.com/api/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ product_id: "prod_001", quantity: 1 }),
    });
    const ordRes = await handleB2BApiRequest(ordReq);
    const ordBody = await ordRes?.json();
    const orderId = ordBody.data.order_id;

    // Submit refund
    const refReq1 = new Request(`https://example.com/api/v1/orders/${orderId}/refund-requests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "Licença apresentou erro na máquina do cliente final" }),
    });
    const refRes1 = await handleB2BApiRequest(refReq1);
    expect(refRes1?.status).toBe(201);

    // Duplicate refund request for same order
    const refReq2 = new Request(`https://example.com/api/v1/orders/${orderId}/refund-requests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "Segunda solicitação para o mesmo pedido" }),
    });
    const refRes2 = await handleB2BApiRequest(refReq2);
    expect(refRes2?.status).toBe(409);
  });

  // 12. Confirmação PIX
  it("12. Cria solicitação de recarga PIX e confirmação credita a carteira do revendedor", async () => {
    const initialBalance = fallbackStore.wallets.get(resellerId)!.balance;

    // Create deposit
    const depReq = new Request("https://example.com/api/v1/wallet/deposits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 100.0 }),
    });
    const depRes = await handleB2BApiRequest(depReq);
    expect(depRes?.status).toBe(201);
    const depBody = await depRes?.json();
    const depositId = depBody.data.deposit_id;
    expect(depBody.data.pix_code).toBeDefined();

    // Confirm deposit
    const simReq = new Request(
      `https://example.com/api/v1/wallet/deposits/${depositId}/simulate-pay`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${validKey}` },
      },
    );
    const simRes = await handleB2BApiRequest(simReq);
    expect(simRes?.status).toBe(200);

    const newBalance = fallbackStore.wallets.get(resellerId)!.balance;
    expect(newBalance).toBe(initialBalance + 100.0);
  });

  // 13. Assinatura de webhook HMAC-SHA256
  it("13. Assinatura HMAC-SHA256 é calculada e verificada com precisão", () => {
    const payload = JSON.stringify({
      event: "order.completed",
      order_id: "ORD-9999",
      amount: 45.0,
    });
    const secret = "whsec_super_secret_reseller_key";

    const signature = generateWebhookSignature(payload, secret);
    expect(typeof signature).toBe("string");
    expect(signature.length).toBe(64); // SHA-256 hex is 64 chars

    const isValid = verifyWebhookSignature(payload, secret, signature);
    expect(isValid).toBe(true);

    // Tampered payload
    const tampered = payload.replace("ORD-9999", "ORD-TAMPERED");
    const isTamperedValid = verifyWebhookSignature(tampered, secret, signature);
    expect(isTamperedValid).toBe(false);
  });

  // 14. Revogação de API Key
  it("14. Chave revogada é rejeitada com status 403 KEY_REVOKED", async () => {
    const req = new Request("https://example.com/api/v1/wallet", {
      method: "GET",
      headers: { Authorization: `Bearer ${revokedKey}` },
    });
    const res = await handleB2BApiRequest(req);
    expect(res?.status).toBe(403);
    const body = await res?.json();
    expect(body.code).toBe("KEY_REVOKED");
  });

  // 15. Limites de requisições (Rate limiting)
  it("15. Rate Limiter bloqueia requisições excedentes retornando status 429", () => {
    const testKey = "rate_limit_test_key_abc";
    const limit = 3;

    expect(checkRateLimit(testKey, limit).allowed).toBe(true);
    expect(checkRateLimit(testKey, limit).allowed).toBe(true);
    expect(checkRateLimit(testKey, limit).allowed).toBe(true);

    // 4th request exceeds limit
    const fourth = checkRateLimit(testKey, limit);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.resetInSec).toBeGreaterThan(0);
  });
});

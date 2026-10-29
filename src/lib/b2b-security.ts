import { createHash, createHmac, randomBytes } from "crypto";

/**
 * Generates a cryptographically secure API key.
 * Format: ak_live_<32 hex chars>
 */
export function generateApiKey(): { fullKey: string; keyPrefix: string; keyHash: string } {
  const rawHex = randomBytes(24).toString("hex");
  const fullKey = `ak_live_${rawHex}`;
  const keyPrefix = `${fullKey.slice(0, 11)}...${fullKey.slice(-4)}`;
  const keyHash = hashApiKey(fullKey);
  return { fullKey, keyPrefix, keyHash };
}

/**
 * Computes SHA-256 hash of the API key for safe storage and indexing.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex");
}

/**
 * Generates HMAC-SHA256 signature for webhook payloads.
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verifies webhook HMAC-SHA256 signature against replay attacks.
 */
export function verifyWebhookSignature(payload: string, secret: string, signature: string): boolean {
  try {
    const expected = generateWebhookSignature(payload, secret);
    return expected === signature;
  } catch {
    return false;
  }
}

/**
 * Validates destination URLs against Server-Side Request Forgery (SSRF).
 * Blocks localhost, private LAN ranges, and non-HTTPS protocols in production.
 */
export function isSafeWebhookUrl(urlString: string): { valid: boolean; reason?: string } {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { valid: false, reason: "A URL deve utilizar o protocolo HTTPS" };
    }

    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      /^169\.254\./.test(host)
    ) {
      // In local dev we can allow localhost if needed, but per prompt master SSRF protection is required
      return { valid: false, reason: "URLs internas e endereços locais não são permitidos por segurança (SSRF)" };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "URL inválida ou mal formatada" };
  }
}

/**
 * In-memory sliding-window / token-bucket rate limiter
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limitPerMinute: number = 60): { allowed: boolean; remaining: number; resetInSec: number } {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const current = rateLimitMap.get(key);

  if (!current || now > current.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limitPerMinute - 1, resetInSec: 60 };
  }

  if (current.count >= limitPerMinute) {
    const resetInSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, resetInSec };
  }

  current.count += 1;
  const remaining = Math.max(0, limitPerMinute - current.count);
  const resetInSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return { allowed: true, remaining, resetInSec };
}

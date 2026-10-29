/**
 * B2B Security Utilities (Isomorphic: works seamlessly in Node.js and Browser)
 */

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

/**
 * Pure TypeScript SHA-256 implementation (no Node crypto dependency, strictly typed)
 */
function sha256(ascii: string): string {
  const asciiBitLength = ascii.length * 8;
  const wordsLength = (((asciiBitLength + 64) >> 9) << 4) + 16;
  const words = new Uint32Array(wordsLength);

  for (let i = 0; i < ascii.length; i++) {
    const charCode = ascii.charCodeAt(i);
    const idx = i >> 2;
    words[idx] = (words[idx] ?? 0) | ((charCode & 0xff) << (24 - (i % 4) * 8));
  }

  const bitIdx = asciiBitLength >> 5;
  words[bitIdx] = (words[bitIdx] ?? 0) | (0x80 << (24 - (asciiBitLength % 32)));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const w = new Uint32Array(64);
  const oldHash = new Uint32Array(8);

  for (let i = 0; i < words.length; i += 16) {
    for (let h = 0; h < 8; h++) {
      oldHash[h] = hash[h] ?? 0;
    }

    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] ?? 0;
      } else {
        const w15 = w[j - 15] ?? 0;
        const w2 = w[j - 2] ?? 0;
        const w16 = w[j - 16] ?? 0;
        const w7 = w[j - 7] ?? 0;
        const gamma0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const gamma1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        w[j] = (w16 + gamma0 + w7 + gamma1) | 0;
      }

      const h0 = hash[0] ?? 0;
      const h1 = hash[1] ?? 0;
      const h2 = hash[2] ?? 0;
      const h3 = hash[3] ?? 0;
      const h4 = hash[4] ?? 0;
      const h5 = hash[5] ?? 0;
      const h6 = hash[6] ?? 0;
      const h7 = hash[7] ?? 0;
      const kj = k[j] ?? 0;
      const wj = w[j] ?? 0;

      const s1 = rightRotate(h4, 6) ^ rightRotate(h4, 11) ^ rightRotate(h4, 25);
      const ch = (h4 & h5) ^ (~h4 & h6);
      const temp1 = (h7 + s1 + ch + kj + wj) | 0;

      const s0 = rightRotate(h0, 2) ^ rightRotate(h0, 13) ^ rightRotate(h0, 22);
      const maj = (h0 & h1) ^ (h0 & h2) ^ (h1 & h2);
      const temp2 = (s0 + maj) | 0;

      hash[7] = h6;
      hash[6] = h5;
      hash[5] = h4;
      hash[4] = (h3 + temp1) | 0;
      hash[3] = h2;
      hash[2] = h1;
      hash[1] = h0;
      hash[0] = (temp1 + temp2) | 0;
    }

    for (let j = 0; j < 8; j++) {
      hash[j] = ((hash[j] ?? 0) + (oldHash[j] ?? 0)) | 0;
    }
  }

  let result = "";
  for (let i = 0; i < 8; i++) {
    const val = hash[i] ?? 0;
    for (let j = 3; j >= 0; j--) {
      const byte = (val >> (j * 8)) & 255;
      result += (byte < 16 ? "0" : "") + byte.toString(16);
    }
  }
  return result;
}

/**
 * Pure HMAC-SHA256 implementation
 */
function hmacSha256(key: string, message: string): string {
  const blockSize = 64;
  const keyBytes: number[] = [];
  if (key.length > blockSize) {
    const hashed = sha256(key);
    for (let i = 0; i < hashed.length; i += 2) {
      keyBytes.push(parseInt(hashed.substring(i, i + 2), 16));
    }
  } else {
    for (let i = 0; i < key.length; i++) {
      keyBytes.push(key.charCodeAt(i));
    }
  }
  while (keyBytes.length < blockSize) {
    keyBytes.push(0);
  }

  let oKeyPad = "";
  let iKeyPad = "";
  for (let i = 0; i < blockSize; i++) {
    const kb = keyBytes[i] ?? 0;
    oKeyPad += String.fromCharCode(kb ^ 0x5c);
    iKeyPad += String.fromCharCode(kb ^ 0x36);
  }

  const innerHash = sha256(iKeyPad + message);
  let innerHashStr = "";
  for (let i = 0; i < innerHash.length; i += 2) {
    innerHashStr += String.fromCharCode(parseInt(innerHash.substring(i, i + 2), 16));
  }

  return sha256(oKeyPad + innerHashStr);
}

function getRandomHex(bytesLength: number): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(bytesLength);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let hex = "";
  for (let i = 0; i < bytesLength; i++) {
    hex += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
  }
  return hex;
}

/**
 * Generates a cryptographically secure API key.
 * Format: ak_live_<48 hex chars>
 */
export function generateApiKey(): { fullKey: string; keyPrefix: string; keyHash: string } {
  const rawHex = getRandomHex(24);
  const fullKey = `ak_live_${rawHex}`;
  const keyPrefix = `${fullKey.slice(0, 11)}...${fullKey.slice(-4)}`;
  const keyHash = hashApiKey(fullKey);
  return { fullKey, keyPrefix, keyHash };
}

/**
 * Computes SHA-256 hash of the API key for safe storage and indexing.
 */
export function hashApiKey(key: string): string {
  return sha256(key.trim());
}

/**
 * Generates HMAC-SHA256 signature for webhook payloads.
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return hmacSha256(secret, payload);
}

/**
 * Verifies webhook HMAC-SHA256 signature against replay attacks.
 */
export function verifyWebhookSignature(
  payload: string,
  secret: string,
  signature: string,
): boolean {
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
      return {
        valid: false,
        reason: "URLs internas e endereços locais não são permitidos por segurança (SSRF)",
      };
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

export function checkRateLimit(
  key: string,
  limitPerMinute: number = 60,
): { allowed: boolean; remaining: number; resetInSec: number } {
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

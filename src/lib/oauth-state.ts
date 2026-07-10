import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "./env";

/**
 * Signed OAuth `state` for CSRF protection and to carry the tenant/client
 * across the redirect to Meta and back. The callback has no session cookie from
 * the third party, so the (HMAC-signed, tamper-proof) state is what tells us
 * which agency + client the returned tokens belong to.
 *
 * Format: `<base64url(json)>.<base64url(hmac-sha256)>`.
 */

function signingKey(): Buffer {
  const { TOKEN_ENCRYPTION_KEY } = getEnv();
  if (!TOKEN_ENCRYPTION_KEY) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required to sign OAuth state.");
  }
  return Buffer.from(TOKEN_ENCRYPTION_KEY, "base64");
}

export interface OAuthState {
  agencyId: string;
  clientId: string;
  nonce: string;
}

export function signState(input: { agencyId: string; clientId: string }): string {
  const state: OAuthState = { ...input, nonce: randomBytes(8).toString("hex") };
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  const mac = createHmac("sha256", signingKey()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyState(token: string | null): OAuthState | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", signingKey()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (parsed && typeof parsed.agencyId === "string" && typeof parsed.clientId === "string") {
      return parsed as OAuthState;
    }
    return null;
  } catch {
    return null;
  }
}

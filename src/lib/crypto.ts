import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { getEnv } from "./env";

/**
 * App-level encryption for social OAuth tokens at rest.
 *
 * These are credentials for other people's businesses, so raw tokens must never
 * be persisted or logged. We use AES-256-GCM (authenticated encryption): a
 * random 12-byte IV per message, and the 16-byte auth tag is stored alongside.
 *
 * Serialized format (base64 fields, dot-separated): `iv.authTag.ciphertext`.
 *
 * In the production stack this can be swapped for KMS-backed envelope encryption
 * without changing callers — the interface is just encrypt()/decrypt().
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const { TOKEN_ENCRYPTION_KEY } = getEnv();
  if (!TOKEN_ENCRYPTION_KEY) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set. Generate one with: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  const key = Buffer.from(TOKEN_ENCRYPTION_KEY, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes, got ${key.length}.`,
    );
  }
  return key;
}

/** Encrypt a plaintext token. Returns `iv.authTag.ciphertext` (all base64). */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/** Decrypt a value produced by {@link encryptToken}. */
export function decryptToken(serialized: string): string {
  const parts = serialized.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted token: expected iv.authTag.ciphertext");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Encrypt only if a value is present; passes through null/undefined. */
export function maybeEncrypt(
  plaintext: string | null | undefined,
): string | null {
  return plaintext ? encryptToken(plaintext) : null;
}

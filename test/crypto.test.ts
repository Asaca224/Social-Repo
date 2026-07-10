import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, maybeEncrypt } from "@/lib/crypto";

describe("token crypto (AES-256-GCM)", () => {
  it("round-trips a token", () => {
    const secret = "EAAG_meta_page_token_abc123";
    const blob = encryptToken(secret);
    expect(blob.split(".")).toHaveLength(3);
    expect(blob).not.toContain(secret);
    expect(decryptToken(blob)).toBe(secret);
  });

  it("produces a fresh IV each call (ciphertext differs)", () => {
    const a = encryptToken("same-input");
    const b = encryptToken("same-input");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(decryptToken(b));
  });

  it("rejects a tampered ciphertext via the auth tag", () => {
    const blob = encryptToken("do-not-tamper");
    const parts = blob.split(".");
    parts[2] = Buffer.from("tampered-bytes").toString("base64");
    expect(() => decryptToken(parts.join("."))).toThrow();
  });

  it("rejects malformed input", () => {
    expect(() => decryptToken("not-valid")).toThrow(/Malformed/);
  });

  it("maybeEncrypt passes through empty values", () => {
    expect(maybeEncrypt(null)).toBeNull();
    expect(maybeEncrypt(undefined)).toBeNull();
    expect(maybeEncrypt("")).toBeNull();
    expect(decryptToken(maybeEncrypt("x") as string)).toBe("x");
  });
});

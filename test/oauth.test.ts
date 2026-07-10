import { describe, expect, it } from "vitest";
import { signState, verifyState } from "@/lib/oauth-state";
import { buildAuthUrl } from "@/lib/meta-oauth";

describe("OAuth state signing", () => {
  it("round-trips agency + client and adds a nonce", () => {
    const token = signState({ agencyId: "ag_1", clientId: "cl_1" });
    const parsed = verifyState(token);
    expect(parsed).toMatchObject({ agencyId: "ag_1", clientId: "cl_1" });
    expect(parsed?.nonce).toBeTruthy();
  });

  it("rejects a tampered payload", () => {
    const token = signState({ agencyId: "ag_1", clientId: "cl_1" });
    const [, mac] = token.split(".");
    const forged =
      Buffer.from(JSON.stringify({ agencyId: "attacker", clientId: "cl_1", nonce: "x" })).toString(
        "base64url",
      ) +
      "." +
      mac;
    expect(verifyState(forged)).toBeNull();
  });

  it("rejects malformed / missing tokens", () => {
    expect(verifyState(null)).toBeNull();
    expect(verifyState("nope")).toBeNull();
    expect(verifyState("a.b")).toBeNull();
  });
});

describe("buildAuthUrl", () => {
  it("targets the Facebook dialog with our scopes and state", () => {
    process.env.META_APP_ID = "app_123";
    process.env.APP_URL = "https://app.example.com";
    const url = new URL(buildAuthUrl("STATE"));
    expect(url.host).toBe("www.facebook.com");
    expect(url.pathname).toContain("/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("app_123");
    expect(url.searchParams.get("state")).toBe("STATE");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/oauth/meta/callback",
    );
    expect(url.searchParams.get("scope")).toContain("instagram_content_publish");
    expect(url.searchParams.get("scope")).toContain("pages_manage_posts");
  });
});

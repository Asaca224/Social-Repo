/**
 * TikTok Login Kit (OAuth 2.0) for connecting an account. Publishing (the
 * Content Posting API's video init → upload → publish flow) is deferred; this
 * only authenticates and stores the account + tokens.
 *
 * The user authorizes on TikTok's own page; we exchange the code for an access
 * token (+ refresh token) and the account's `open_id`. See README for the
 * one-time TikTok developer-app setup.
 */

// Connect-only scope. Publishing later additionally needs `video.publish`.
const SCOPES = ["user.info.basic"];

export function tiktokOAuthConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

export function redirectUri(): string {
  if (process.env.TIKTOK_OAUTH_REDIRECT_URI) return process.env.TIKTOK_OAUTH_REDIRECT_URI;
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/oauth/tiktok/callback`;
}

/** Build the TikTok authorization-dialog URL to redirect the user to. */
export function buildAuthUrl(state: string): string {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY ?? "");
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

export interface TikTokToken {
  openId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
}

/** Exchange an auth code for an access token + open_id. */
export async function exchangeCode(code: string): Promise<TikTokToken> {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
      client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    open_id?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || body.error || !body.access_token || !body.open_id) {
    throw new Error(body.error_description ?? body.error ?? `TikTok OAuth HTTP ${res.status}`);
  }
  return {
    openId: body.open_id,
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresIn: body.expires_in ?? null,
  };
}

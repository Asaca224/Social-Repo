import { getEnv } from "./env";

/**
 * Meta (Facebook Login) OAuth for connecting Pages + linked Instagram accounts.
 *
 * The user authorizes on Meta's own login dialog; we never see their password.
 * We exchange the returned code for a long-lived token, then list the Pages the
 * user granted (each with its own Page token and any linked Instagram Business
 * account). See docs/README for the one-time Meta app setup.
 */

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];

export function metaOAuthConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function redirectUri(): string {
  if (process.env.META_OAUTH_REDIRECT_URI) return process.env.META_OAUTH_REDIRECT_URI;
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/oauth/meta/callback`;
}

/** Build the Facebook login-dialog URL to redirect the user to. */
export function buildAuthUrl(state: string): string {
  const { META_GRAPH_API_VERSION } = getEnv();
  const url = new URL(`https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(","));
  return url.toString();
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const { META_GRAPH_API_VERSION } = getEnv();
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { method: "GET" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok || body.error) {
    throw new Error(body.error?.message ?? `Meta OAuth HTTP ${res.status}`);
  }
  return body as T;
}

/** Exchange an auth code for a (short-lived) user access token. */
export async function exchangeCode(code: string): Promise<string> {
  const data = await graphGet<{ access_token: string }>("oauth/access_token", {
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: redirectUri(),
    code,
  });
  return data.access_token;
}

/** Exchange a short-lived user token for a long-lived one (~60 days). */
export async function longLivedToken(shortToken: string): Promise<string> {
  const data = await graphGet<{ access_token: string }>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    fb_exchange_token: shortToken,
  });
  return data.access_token;
}

export interface MetaPage {
  id: string;
  name: string;
  accessToken: string;
  instagram: { id: string; username?: string } | null;
}

/** List the Pages the user granted, with their tokens and linked IG accounts. */
export async function listPages(userToken: string): Promise<MetaPage[]> {
  const data = await graphGet<{
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string };
    }>;
  }>("me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    access_token: userToken,
  });
  return (data.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    accessToken: p.access_token,
    instagram: p.instagram_business_account
      ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username }
      : null,
  }));
}

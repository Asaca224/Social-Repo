import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { exchangeCode, tiktokOAuthConfigured } from "@/lib/tiktok-oauth";
import { verifyState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

/**
 * TikTok OAuth callback: exchange the code for tokens and connect the account
 * to the client from the signed state. Tokens are encrypted at rest. Publishing
 * (Content Posting API) is deferred — this stores the connection only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (params: string) => NextResponse.redirect(new URL(`/dashboard?${params}`, request.url));

  if (!tiktokOAuthConfigured()) return back("oauth=notconfigured");
  if (url.searchParams.get("error")) return back("oauth=denied");

  const code = url.searchParams.get("code");
  const state = verifyState(url.searchParams.get("state"));
  if (!code || !state) return back("oauth=badstate");

  try {
    const token = await exchangeCode(code);
    const encrypted = encryptToken(token.accessToken);
    const encryptedRefresh = token.refreshToken ? encryptToken(token.refreshToken) : null;
    const expiresAt = token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000) : null;

    await prisma.socialAccount.upsert({
      where: {
        platform_externalAccountId: { platform: "tiktok", externalAccountId: token.openId },
      },
      create: {
        clientId: state.clientId,
        platform: "tiktok",
        externalAccountId: token.openId,
        accessToken: encrypted,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: expiresAt,
        status: "connected",
      },
      update: {
        accessToken: encrypted,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: expiresAt,
        status: "connected",
      },
    });

    return back("oauth=connected&count=1");
  } catch {
    return back("oauth=error");
  }
}

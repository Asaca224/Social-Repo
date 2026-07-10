import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { exchangeCode, listPages, longLivedToken, metaOAuthConfigured } from "@/lib/meta-oauth";
import { verifyState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

/**
 * Meta OAuth callback: exchange the code for a long-lived token, list the
 * granted Pages (+ linked Instagram Business accounts), and connect each to the
 * client from the signed state. Tokens are encrypted at rest. Redirects back to
 * the dashboard with a result.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (params: string) =>
    NextResponse.redirect(new URL(`/dashboard?provider=meta&${params}`, request.url));

  if (!metaOAuthConfigured()) return back("oauth=notconfigured");
  if (url.searchParams.get("error")) return back("oauth=denied");

  const code = url.searchParams.get("code");
  const state = verifyState(url.searchParams.get("state"));
  if (!code || !state) return back("oauth=badstate");

  try {
    const shortToken = await exchangeCode(code);
    const token = await longLivedToken(shortToken);
    const pages = await listPages(token);

    let connected = 0;
    for (const page of pages) {
      const encrypted = encryptToken(page.accessToken);
      await prisma.socialAccount.upsert({
        where: {
          platform_externalAccountId: { platform: "facebook", externalAccountId: page.id },
        },
        create: {
          clientId: state.clientId,
          platform: "facebook",
          externalAccountId: page.id,
          accessToken: encrypted,
          status: "connected",
        },
        update: { accessToken: encrypted, status: "connected" },
      });
      connected += 1;

      if (page.instagram) {
        await prisma.socialAccount.upsert({
          where: {
            platform_externalAccountId: {
              platform: "instagram",
              externalAccountId: page.instagram.id,
            },
          },
          create: {
            clientId: state.clientId,
            platform: "instagram",
            externalAccountId: page.instagram.id,
            accountType: "business",
            accessToken: encrypted,
            status: "connected",
          },
          update: { accessToken: encrypted, status: "connected", accountType: "business" },
        });
        connected += 1;
      }
    }

    return back(`oauth=connected&count=${connected}`);
  } catch {
    return back("oauth=error");
  }
}

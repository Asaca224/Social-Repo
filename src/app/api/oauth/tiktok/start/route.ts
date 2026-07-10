import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isClerkEnabled, resolveTenant } from "@/lib/auth";
import { buildAuthUrl, tiktokOAuthConfigured } from "@/lib/tiktok-oauth";
import { signState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

/** Begin the TikTok OAuth flow: verify the client, sign state, redirect. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (params: string) =>
    NextResponse.redirect(new URL(`/dashboard?provider=tiktok&${params}`, request.url));

  if (!tiktokOAuthConfigured()) return back("oauth=notconfigured");

  const clientId = url.searchParams.get("clientId");
  if (!clientId) return back("oauth=error");

  let agencyId: string | null;
  if (isClerkEnabled()) {
    const ctx = await resolveTenant(request);
    agencyId = ctx?.agencyId ?? null;
  } else {
    agencyId = url.searchParams.get("agencyId");
  }
  if (!agencyId) return back("oauth=noagency");

  const client = await prisma.client.findFirst({
    where: { id: clientId, agencyId },
    select: { id: true },
  });
  if (!client) return back("oauth=noclient");

  return NextResponse.redirect(buildAuthUrl(signState({ agencyId, clientId })));
}

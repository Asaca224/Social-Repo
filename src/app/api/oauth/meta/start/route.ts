import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isClerkEnabled, resolveTenant } from "@/lib/auth";
import { buildAuthUrl, metaOAuthConfigured } from "@/lib/meta-oauth";
import { signState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

/**
 * Begin the Meta OAuth flow: verify the client belongs to the tenant, sign the
 * state, and redirect the user to Facebook's login dialog.
 *
 * Tenant: from the Clerk session when enabled, else from an `agencyId` query
 * param (dev, matching the x-agency-id header model). The state is HMAC-signed
 * so the callback can trust which agency/client to attach the tokens to.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (params: string) => NextResponse.redirect(new URL(`/dashboard?${params}`, request.url));

  if (!metaOAuthConfigured()) return back("oauth=notconfigured");

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

  const state = signState({ agencyId, clientId });
  return NextResponse.redirect(buildAuthUrl(state));
}

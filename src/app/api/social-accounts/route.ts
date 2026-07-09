import { z } from "zod";
import { Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { assertClientInTenant, TenantAccessError } from "@/lib/tenancy";
import { errorResponse, json, zodErrorResponse } from "@/lib/api";
import { resolveTenant } from "@/lib/auth";
import { canConnectAccount, effectiveAccountLimit } from "@/lib/billing";

export const dynamic = "force-dynamic";

/** List a client's connected accounts (never returns tokens). */
export async function GET(request: Request) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return errorResponse("clientId query param required", 400);

  try {
    await assertClientInTenant(ctx, clientId);
  } catch (err) {
    if (err instanceof TenantAccessError) return errorResponse("Client not found", 404);
    throw err;
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { clientId },
    select: {
      id: true,
      platform: true,
      externalAccountId: true,
      status: true,
      tokenExpiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return json({ accounts });
}

const connectSchema = z.object({
  clientId: z.string().min(1),
  platform: z.nativeEnum(Platform),
  externalAccountId: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  tokenExpiresAt: z.string().datetime().optional(),
});

/**
 * Connect (or re-connect) a social account. Tokens are encrypted at rest before
 * storage. In a full OAuth flow these tokens come from the platform callback;
 * this endpoint accepts them directly so the publish flow is exercisable now.
 */
export async function POST(request: Request) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const body = await request.json().catch(() => null);
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const data = parsed.data;
  try {
    await assertClientInTenant(ctx, data.clientId);
  } catch (err) {
    if (err instanceof TenantAccessError) return errorResponse("Client not found", 404);
    throw err;
  }

  // Enforce the plan's account limit — only when connecting a NEW account
  // (re-connecting an existing one doesn't grow the count).
  const existing = await prisma.socialAccount.findUnique({
    where: {
      platform_externalAccountId: {
        platform: data.platform,
        externalAccountId: data.externalAccountId,
      },
    },
    select: { id: true },
  });
  if (!existing) {
    const [sub, count] = await Promise.all([
      prisma.subscription.findUnique({
        where: { agencyId: ctx.agencyId },
        select: { status: true, accountsLimit: true },
      }),
      prisma.socialAccount.count({
        where: { client: { agencyId: ctx.agencyId } },
      }),
    ]);
    if (!canConnectAccount(count, effectiveAccountLimit(sub))) {
      return errorResponse(
        "Account limit reached for your plan. Upgrade to connect more accounts.",
        402,
      );
    }
  }

  const account = await prisma.socialAccount.upsert({
    where: {
      platform_externalAccountId: {
        platform: data.platform,
        externalAccountId: data.externalAccountId,
      },
    },
    create: {
      clientId: data.clientId,
      platform: data.platform,
      externalAccountId: data.externalAccountId,
      accessToken: encryptToken(data.accessToken),
      refreshToken: data.refreshToken ? encryptToken(data.refreshToken) : null,
      tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null,
      status: "connected",
    },
    update: {
      accessToken: encryptToken(data.accessToken),
      refreshToken: data.refreshToken ? encryptToken(data.refreshToken) : null,
      tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null,
      status: "connected",
    },
    select: { id: true, platform: true, externalAccountId: true, status: true },
  });
  return json({ account }, { status: 201 });
}

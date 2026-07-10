import { z } from "zod";
import { CommentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertClientInTenant, TenantAccessError } from "@/lib/tenancy";
import { errorResponse, json } from "@/lib/api";
import { resolveTenant } from "@/lib/auth";

export const dynamic = "force-dynamic";

const statusEnum = z.nativeEnum(CommentStatus);

/**
 * Unified inbox feed: comments across all of a client's connected accounts,
 * newest first, optionally filtered by status.
 */
export async function GET(request: Request) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) return errorResponse("clientId query param required", 400);

  const statusParam = url.searchParams.get("status");
  const status = statusParam ? statusEnum.safeParse(statusParam) : null;
  if (status && !status.success) return errorResponse("invalid status", 400);

  try {
    await assertClientInTenant(ctx, clientId);
  } catch (err) {
    if (err instanceof TenantAccessError) return errorResponse("Client not found", 404);
    throw err;
  }

  const comments = await prisma.comment.findMany({
    where: {
      socialAccount: { clientId },
      ...(status?.success ? { status: status.data } : {}),
    },
    orderBy: { receivedAt: "desc" },
    take: 200,
    select: {
      id: true,
      authorName: true,
      body: true,
      sentiment: true,
      assignedTo: true,
      status: true,
      receivedAt: true,
      socialAccount: { select: { platform: true, externalAccountId: true } },
    },
  });
  return json({ comments });
}

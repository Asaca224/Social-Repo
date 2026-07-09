import { z } from "zod";
import { Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertClientInTenant, TenantAccessError } from "@/lib/tenancy";
import { errorResponse, json, resolveTenant, zodErrorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

const platformEnum = z.nativeEnum(Platform);

/** List posts for a client (workspace) within the current agency. */
export async function GET(request: Request) {
  const ctx = resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return errorResponse("clientId query param required", 400);

  try {
    await assertClientInTenant(ctx, clientId);
  } catch (err) {
    if (err instanceof TenantAccessError) return errorResponse("Client not found", 404);
    throw err;
  }

  const posts = await prisma.post.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });
  return json({ posts });
}

const createPostSchema = z.object({
  clientId: z.string().min(1),
  createdBy: z.string().min(1),
  content: z.string().min(1).max(10_000),
  mediaUrls: z.array(z.string().url()).default([]),
  platformTargets: z.array(platformEnum).min(1),
});

/**
 * Create a draft post. Phase 1 has no scheduling — posts start as `draft` and
 * are published manually via the (later) publish action. This endpoint only
 * persists the draft after verifying the client belongs to the tenant.
 */
export async function POST(request: Request) {
  const ctx = resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const body = await request.json().catch(() => null);
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    await assertClientInTenant(ctx, parsed.data.clientId);
  } catch (err) {
    if (err instanceof TenantAccessError) return errorResponse("Client not found", 404);
    throw err;
  }

  const post = await prisma.post.create({
    data: {
      clientId: parsed.data.clientId,
      createdBy: parsed.data.createdBy,
      content: parsed.data.content,
      mediaUrls: parsed.data.mediaUrls,
      platformTargets: parsed.data.platformTargets,
      status: "draft",
    },
  });
  return json({ post }, { status: 201 });
}

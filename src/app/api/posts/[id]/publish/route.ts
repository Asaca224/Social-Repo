import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/adapters";
import { decryptToken } from "@/lib/crypto";
import { publishPost } from "@/lib/publish";
import { prismaPublishStore } from "@/lib/publish-store";
import { errorResponse, json, resolveTenant } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Manual publish (Phase 1). Publishes a draft/approved post to each of its
 * target platforms via the platform adapters, then records the result.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const outcome = await publishPost(params.id, {
    store: prismaPublishStore(prisma, ctx),
    getAdapter,
    decrypt: decryptToken,
  });

  if (outcome.ok) {
    return json({ status: "published", platformPostIds: outcome.platformPostIds });
  }

  switch (outcome.reason) {
    case "not_found":
      return errorResponse("Post not found", 404);
    case "not_publishable":
      return json(
        { error: "Post cannot be published", detail: outcome.errors },
        { status: 409 },
      );
    case "partial_failure":
      return json(
        {
          status: "failed",
          platformPostIds: outcome.platformPostIds,
          errors: outcome.errors,
        },
        { status: 502 },
      );
  }
}

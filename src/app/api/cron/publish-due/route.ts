import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/adapters";
import { decryptToken } from "@/lib/crypto";
import { json, errorResponse } from "@/lib/api";
import { publishPost } from "@/lib/publish";
import { systemPublishStore } from "@/lib/publish-store";
import { runDuePublish } from "@/lib/schedule-runner";

export const dynamic = "force-dynamic";

/**
 * Scheduled-publish tick. Invoked by Vercel Cron (see vercel.json). Publishes
 * every post whose scheduled time has arrived.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends this
 * header automatically when CRON_SECRET is configured. Returns 503 if the secret
 * is not set, so it can never run unauthenticated.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return errorResponse("CRON_SECRET is not configured", 503);
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return errorResponse("Unauthorized", 401);
  }

  const store = systemPublishStore(prisma);
  const summary = await runDuePublish({
    store: {
      async findDuePostIds(now, limit) {
        const rows = await prisma.post.findMany({
          where: { status: "scheduled", scheduledFor: { lte: now } },
          select: { id: true },
          orderBy: { scheduledFor: "asc" },
          take: limit,
        });
        return rows.map((r) => r.id);
      },
    },
    publishOne: (postId) =>
      publishPost(postId, { store, getAdapter, decrypt: decryptToken }),
  });

  return json(summary);
}

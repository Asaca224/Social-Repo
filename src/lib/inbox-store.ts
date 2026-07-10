import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { FetchedComment } from "./adapters";
import type { UpsertResult } from "./inbox";

/**
 * Prisma-backed inbox persistence shared by the polling cron and the webhook.
 */

/** Upsert a comment, deduplicated on (socialAccountId, platformCommentId). */
export function prismaUpsertComment(prisma: PrismaClient) {
  return async (
    comment: FetchedComment & { socialAccountId: string },
  ): Promise<UpsertResult> => {
    try {
      await prisma.comment.create({
        data: {
          socialAccountId: comment.socialAccountId,
          platformCommentId: comment.platformCommentId,
          authorName: comment.authorName,
          body: comment.body,
          receivedAt: comment.receivedAt,
          status: "open",
        },
      });
      return "created";
    } catch (err) {
      // Unique-constraint violation → we've already ingested this comment.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return "existing";
      }
      throw err;
    }
  };
}

/** Resolve a connected account by its platform-side id (for webhook routing). */
export async function findAccountByExternalId(
  prisma: PrismaClient,
  externalAccountId: string,
): Promise<{ id: string } | null> {
  return prisma.socialAccount.findFirst({
    where: { externalAccountId, status: "connected" },
    select: { id: true },
  });
}

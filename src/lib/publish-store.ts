import { Prisma } from "@prisma/client";
import type { Platform, PrismaClient } from "@prisma/client";
import type { TenantContext } from "./tenancy";
import type { ConnectedAccount, PublishStore, PublishablePost } from "./publish";

/**
 * Prisma-backed {@link PublishStore}, scoped to a tenant. `findPost` only
 * resolves posts whose client belongs to `ctx.agencyId`, so cross-tenant
 * publish attempts read as "not found".
 */
export function prismaPublishStore(
  prisma: PrismaClient,
  ctx: TenantContext,
): PublishStore {
  return {
    async findPost(postId: string): Promise<PublishablePost | null> {
      const post = await prisma.post.findFirst({
        where: { id: postId, client: { agencyId: ctx.agencyId } },
        select: {
          id: true,
          clientId: true,
          content: true,
          mediaUrls: true,
          platformTargets: true,
          status: true,
        },
      });
      return post;
    },

    async findConnectedAccount(
      clientId: string,
      platform: Platform,
    ): Promise<ConnectedAccount | null> {
      const account = await prisma.socialAccount.findFirst({
        where: {
          clientId,
          platform,
          status: "connected",
          accessToken: { not: null },
        },
        select: {
          externalAccountId: true,
          accessToken: true,
          refreshToken: true,
        },
      });
      if (!account || !account.accessToken) return null;
      return {
        externalAccountId: account.externalAccountId,
        accessTokenEncrypted: account.accessToken,
        refreshTokenEncrypted: account.refreshToken,
      };
    },

    async markPublished(
      postId: string,
      platformPostIds: Record<string, string>,
      publishedAt: Date,
    ): Promise<void> {
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: "published",
          publishedAt,
          platformPostIds: platformPostIds as Prisma.InputJsonValue,
        },
      });
    },

    async markFailed(postId: string): Promise<void> {
      await prisma.post.update({
        where: { id: postId },
        data: { status: "failed" },
      });
    },
  };
}

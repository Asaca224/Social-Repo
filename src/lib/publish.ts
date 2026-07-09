import type { Platform } from "@prisma/client";
import type { PlatformAdapter } from "./adapters";

/**
 * Manual-publish orchestration (Phase 1). Kept free of Prisma and Next so it can
 * be unit-tested with fakes; the route supplies a Prisma-backed {@link PublishStore}.
 *
 * A post publishes to each of its `platformTargets`: we look up the client's
 * connected account for that platform, decrypt its token, and hand off to the
 * platform adapter. All targets must succeed for the post to be marked
 * `published`; any failure marks it `failed` and reports per-platform errors.
 */

export interface PublishablePost {
  id: string;
  clientId: string;
  content: string;
  mediaUrls: string[];
  platformTargets: Platform[];
  status: string;
}

export interface ConnectedAccount {
  externalAccountId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
}

export interface PublishStore {
  findPost(postId: string): Promise<PublishablePost | null>;
  findConnectedAccount(
    clientId: string,
    platform: Platform,
  ): Promise<ConnectedAccount | null>;
  markPublished(
    postId: string,
    platformPostIds: Record<string, string>,
    publishedAt: Date,
  ): Promise<void>;
  markFailed(postId: string): Promise<void>;
}

export interface PublishDeps {
  store: PublishStore;
  getAdapter: (platform: Platform) => PlatformAdapter;
  decrypt: (serialized: string) => string;
  now?: () => Date;
}

export type PublishOutcome =
  | { ok: true; platformPostIds: Record<string, string> }
  | {
      ok: false;
      reason: "not_found" | "not_publishable" | "partial_failure";
      platformPostIds: Record<string, string>;
      errors: Record<string, string>;
    };

// Statuses from which a manual publish is allowed.
const PUBLISHABLE = new Set(["draft", "approved", "scheduled", "failed"]);

export async function publishPost(
  postId: string,
  deps: PublishDeps,
): Promise<PublishOutcome> {
  const now = deps.now ?? (() => new Date());
  const post = await deps.store.findPost(postId);

  if (!post) {
    return { ok: false, reason: "not_found", platformPostIds: {}, errors: {} };
  }
  if (!PUBLISHABLE.has(post.status) || post.platformTargets.length === 0) {
    return {
      ok: false,
      reason: "not_publishable",
      platformPostIds: {},
      errors: { _: `post status '${post.status}' cannot be published` },
    };
  }

  const platformPostIds: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const platform of post.platformTargets) {
    try {
      const account = await deps.store.findConnectedAccount(
        post.clientId,
        platform,
      );
      if (!account) {
        errors[platform] = "no connected account for this platform";
        continue;
      }
      const adapter = deps.getAdapter(platform);
      const result = await adapter.publishPost(
        {
          externalAccountId: account.externalAccountId,
          accessToken: deps.decrypt(account.accessTokenEncrypted),
          refreshToken: account.refreshTokenEncrypted
            ? deps.decrypt(account.refreshTokenEncrypted)
            : null,
        },
        { content: post.content, mediaUrls: post.mediaUrls },
      );
      platformPostIds[platform] = result.platformPostId;
    } catch (err) {
      errors[platform] = err instanceof Error ? err.message : "publish failed";
    }
  }

  if (Object.keys(errors).length > 0) {
    await deps.store.markFailed(post.id);
    return { ok: false, reason: "partial_failure", platformPostIds, errors };
  }

  await deps.store.markPublished(post.id, platformPostIds, now());
  return { ok: true, platformPostIds };
}

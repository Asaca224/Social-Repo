import { describe, expect, it, vi } from "vitest";
import type { Platform } from "@prisma/client";
import type { PlatformAdapter } from "@/lib/adapters";
import {
  publishPost,
  type ConnectedAccount,
  type PublishablePost,
  type PublishStore,
} from "@/lib/publish";

function fakeAdapter(
  impl: Partial<PlatformAdapter> & { platform: Platform },
): PlatformAdapter {
  return {
    platform: impl.platform,
    publishPost: impl.publishPost ?? (async () => ({ platformPostId: "x" })),
    fetchComments: impl.fetchComments ?? (async () => []),
    replyToComment:
      impl.replyToComment ?? (async () => ({ platformReplyId: "x" })),
    fetchAnalytics: impl.fetchAnalytics ?? (async () => []),
  };
}

function makeStore(opts: {
  post: PublishablePost | null;
  accounts?: Partial<Record<Platform, ConnectedAccount>>;
}): PublishStore & {
  published: { ids: Record<string, string>; at: Date } | null;
  failed: boolean;
} {
  const state = {
    published: null as { ids: Record<string, string>; at: Date } | null,
    failed: false,
  };
  return {
    ...state,
    async findPost() {
      return opts.post;
    },
    async findConnectedAccount(_clientId, platform) {
      return opts.accounts?.[platform] ?? null;
    },
    async markPublished(_id, ids, at) {
      this.published = { ids, at };
    },
    async markFailed() {
      this.failed = true;
    },
  };
}

const draftPost: PublishablePost = {
  id: "post_1",
  clientId: "client_1",
  content: "hello world",
  mediaUrls: [],
  platformTargets: ["facebook"],
  status: "draft",
};

const account: ConnectedAccount = {
  externalAccountId: "page_123",
  accessTokenEncrypted: "enc(token)",
  refreshTokenEncrypted: null,
};

const identityDecrypt = (s: string) => s;

describe("publishPost orchestration", () => {
  it("returns not_found when the post is missing (or cross-tenant)", async () => {
    const store = makeStore({ post: null });
    const res = await publishPost("nope", {
      store,
      getAdapter: () => fakeAdapter({ platform: "facebook" }),
      decrypt: identityDecrypt,
    });
    expect(res).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("refuses to publish an already-published post", async () => {
    const store = makeStore({ post: { ...draftPost, status: "published" } });
    const res = await publishPost("post_1", {
      store,
      getAdapter: () => fakeAdapter({ platform: "facebook" }),
      decrypt: identityDecrypt,
    });
    expect(res).toMatchObject({ ok: false, reason: "not_publishable" });
    expect(store.failed).toBe(false);
  });

  it("publishes to all targets, decrypts the token, and records ids", async () => {
    const publishSpy = vi.fn(async () => ({ platformPostId: "fb_999" }));
    const store = makeStore({
      post: draftPost,
      accounts: { facebook: account },
    });
    const fixedNow = new Date("2026-07-09T12:00:00Z");

    const res = await publishPost("post_1", {
      store,
      getAdapter: () => fakeAdapter({ platform: "facebook", publishPost: publishSpy }),
      decrypt: identityDecrypt,
      now: () => fixedNow,
    });

    expect(res).toEqual({ ok: true, platformPostIds: { facebook: "fb_999" } });
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({ externalAccountId: "page_123", accessToken: "enc(token)" }),
      { content: "hello world", mediaUrls: [] },
    );
    expect(store.published).toEqual({ ids: { facebook: "fb_999" }, at: fixedNow });
    expect(store.failed).toBe(false);
  });

  it("marks failed when a target has no connected account", async () => {
    const store = makeStore({ post: draftPost, accounts: {} });
    const res = await publishPost("post_1", {
      store,
      getAdapter: () => fakeAdapter({ platform: "facebook" }),
      decrypt: identityDecrypt,
    });
    expect(res).toMatchObject({ ok: false, reason: "partial_failure" });
    expect(store.failed).toBe(true);
  });

  it("marks failed and reports the error when an adapter throws", async () => {
    const store = makeStore({
      post: { ...draftPost, platformTargets: ["facebook", "instagram"] },
      accounts: { facebook: account, instagram: account },
    });
    const res = await publishPost("post_1", {
      store,
      getAdapter: (p) =>
        fakeAdapter({
          platform: p,
          publishPost:
            p === "instagram"
              ? async () => {
                  throw new Error("rate limited");
                }
              : async () => ({ platformPostId: "fb_1" }),
        }),
      decrypt: identityDecrypt,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("partial_failure");
      expect(res.platformPostIds).toEqual({ facebook: "fb_1" });
      expect(res.errors.instagram).toContain("rate limited");
    }
    expect(store.failed).toBe(true);
  });
});

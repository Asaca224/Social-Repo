import { afterEach, describe, expect, it, vi } from "vitest";
import { XAdapter } from "@/lib/adapters/x";
import { NotImplementedError, PlatformError } from "@/lib/adapters/types";

const creds = { externalAccountId: "user_1", accessToken: "tok", refreshToken: null };

function mockFetch(response: unknown, status = 200) {
  const fn = vi.fn(async () =>
    new Response(JSON.stringify(response), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("XAdapter", () => {
  it("publishes a tweet and returns its id", async () => {
    const fetchFn = mockFetch({ data: { id: "tweet_1" } });
    const res = await new XAdapter().publishPost(creds, { content: "hello", mediaUrls: [] });
    expect(res.platformPostId).toBe("tweet_1");
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/2/tweets");
    expect(JSON.parse(init.body as string)).toEqual({ text: "hello" });
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });

  it("replies in-thread with in_reply_to_tweet_id", async () => {
    const fetchFn = mockFetch({ data: { id: "reply_1" } });
    const res = await new XAdapter().replyToComment(creds, {
      platformCommentId: "tweet_9",
      body: "thanks!",
    });
    expect(res.platformReplyId).toBe("reply_1");
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      text: "thanks!",
      reply: { in_reply_to_tweet_id: "tweet_9" },
    });
  });

  it("throws PlatformError on an API error", async () => {
    mockFetch({ title: "Unauthorized", detail: "bad token" }, 401);
    await expect(
      new XAdapter().publishPost(creds, { content: "x", mediaUrls: [] }),
    ).rejects.toBeInstanceOf(PlatformError);
  });

  it("marks unimplemented capabilities clearly", async () => {
    await expect(new XAdapter().fetchComments(creds)).rejects.toBeInstanceOf(NotImplementedError);
  });
});

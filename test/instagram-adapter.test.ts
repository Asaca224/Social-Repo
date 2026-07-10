import { afterEach, describe, expect, it, vi } from "vitest";
import { InstagramAdapter } from "@/lib/adapters/instagram";
import { PlatformError, NotImplementedError } from "@/lib/adapters/types";

const creds = { externalAccountId: "ig_123", accessToken: "tok", refreshToken: null };

/** Queue of responses returned in order across successive fetch calls. */
function mockFetchSequence(responses: unknown[]) {
  let i = 0;
  const fn = vi.fn(async () => {
    const body = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("InstagramAdapter", () => {
  it("publishes via the two-step media -> media_publish flow", async () => {
    const fetchFn = mockFetchSequence([{ id: "container_1" }, { id: "media_1" }]);
    const res = await new InstagramAdapter().publishPost(creds, {
      content: "hello world",
      mediaUrls: ["https://cdn.example.com/a.jpg"],
    });

    expect(res.platformPostId).toBe("media_1");
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const [createUrl, createInit] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
    expect(createUrl.toString()).toContain("/ig_123/media");
    const createBody = (createInit.body as URLSearchParams).toString();
    expect(createBody).toContain("image_url=");
    expect(createBody).toContain("caption=hello+world");

    const [publishUrl, publishInit] = fetchFn.mock.calls[1] as unknown as [URL, RequestInit];
    expect(publishUrl.toString()).toContain("/ig_123/media_publish");
    expect((publishInit.body as URLSearchParams).toString()).toContain("creation_id=container_1");
  });

  it("rejects a text-only post (Instagram requires media)", async () => {
    await expect(
      new InstagramAdapter().publishPost(creds, { content: "hi", mediaUrls: [] }),
    ).rejects.toBeInstanceOf(PlatformError);
  });

  it("throws PlatformError when the Graph API returns an error", async () => {
    mockFetchSequence([{ error: { message: "Invalid IG account", code: 100 } }]);
    await expect(
      new InstagramAdapter().publishPost(creds, {
        content: "x",
        mediaUrls: ["https://cdn.example.com/a.jpg"],
      }),
    ).rejects.toBeInstanceOf(PlatformError);
  });

  it("replies to a comment via the /replies edge", async () => {
    const fetchFn = mockFetchSequence([{ id: "reply_1" }]);
    const res = await new InstagramAdapter().replyToComment(creds, {
      platformCommentId: "cmt_9",
      body: "thanks!",
    });
    expect(res.platformReplyId).toBe("reply_1");
    const [url] = fetchFn.mock.calls[0] as unknown as [URL];
    expect(url.toString()).toContain("/cmt_9/replies");
  });

  it("marks comment/analytics ingestion as not implemented yet", async () => {
    await expect(new InstagramAdapter().fetchComments(creds)).rejects.toBeInstanceOf(
      NotImplementedError,
    );
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaAdapter } from "@/lib/adapters/meta";
import { PlatformError } from "@/lib/adapters/types";

const creds = {
  externalAccountId: "page_42",
  accessToken: "tok_secret",
  refreshToken: null,
};

function mockFetch(response: unknown, ok = true, status = 200) {
  const fn = vi.fn(async () =>
    new Response(JSON.stringify(response), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
  // The adapter passes ok/status through the real Response, so honor `ok`.
  if (!ok) {
    fn.mockImplementation(
      async () =>
        new Response(JSON.stringify(response), {
          status,
          headers: { "content-type": "application/json" },
        }),
    );
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("MetaAdapter", () => {
  it("publishes text to /{pageId}/feed and returns the post id", async () => {
    const fetchFn = mockFetch({ id: "page_42_777" });
    const adapter = new MetaAdapter();

    const res = await adapter.publishPost(creds, {
      content: "hello",
      mediaUrls: [],
    });

    expect(res.platformPostId).toBe("page_42_777");
    const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toContain("/page_42/feed");
    expect(init.method).toBe("POST");
    // Token travels in the body for POSTs, not the URL query.
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain("message=hello");
    expect(body).toContain("access_token=tok_secret");
    expect(url.search).toBe("");
  });

  it("publishes a single image to /{pageId}/photos", async () => {
    const fetchFn = mockFetch({ id: "photo_1", post_id: "page_42_photo" });
    const adapter = new MetaAdapter();

    const res = await adapter.publishPost(creds, {
      content: "caption",
      mediaUrls: ["https://cdn.example.com/a.jpg"],
    });

    expect(res.platformPostId).toBe("page_42_photo");
    const [url] = fetchFn.mock.calls[0] as unknown as [URL];
    expect(url.toString()).toContain("/page_42/photos");
  });

  it("throws PlatformError when Graph returns an error body", async () => {
    mockFetch({ error: { message: "Invalid OAuth token", code: 190 } }, false, 400);
    const adapter = new MetaAdapter();

    await expect(
      adapter.publishPost(creds, { content: "x", mediaUrls: [] }),
    ).rejects.toBeInstanceOf(PlatformError);
  });

  it("maps comments from the Graph response", async () => {
    mockFetch({
      data: [
        {
          id: "c1",
          from: { name: "Jane" },
          message: "nice",
          created_time: "2026-07-01T10:00:00+0000",
        },
      ],
    });
    const adapter = new MetaAdapter();
    const comments = await adapter.fetchComments(creds);
    expect(comments).toEqual([
      {
        platformCommentId: "c1",
        authorName: "Jane",
        body: "nice",
        receivedAt: new Date("2026-07-01T10:00:00+0000"),
      },
    ]);
  });
});

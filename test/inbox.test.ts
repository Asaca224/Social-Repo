import { describe, expect, it, vi } from "vitest";
import { ingestBatch, ingestComments } from "@/lib/inbox";
import type { FetchedComment } from "@/lib/adapters";

const comment = (id: string): FetchedComment => ({
  platformCommentId: id,
  authorName: "Jane",
  body: "hi",
  receivedAt: new Date("2026-07-01T00:00:00Z"),
});

describe("ingestComments", () => {
  it("upserts each fetched comment and counts new ones", async () => {
    const seen = new Set<string>();
    const upsert = vi.fn(async (c: { platformCommentId: string }) => {
      if (seen.has(c.platformCommentId)) return "existing" as const;
      seen.add(c.platformCommentId);
      return "created" as const;
    });

    const summary = await ingestComments({
      socialAccountId: "acc_1",
      fetchComments: async () => [comment("a"), comment("b"), comment("a")],
      upsert,
    });

    expect(summary).toEqual({ fetched: 3, created: 2 });
    // socialAccountId is attached to every upsert.
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ socialAccountId: "acc_1" }));
  });

  it("passes the since cursor to fetchComments", async () => {
    const fetchComments = vi.fn(async () => []);
    const since = new Date("2026-06-01T00:00:00Z");
    await ingestComments({
      socialAccountId: "acc_1",
      fetchComments,
      upsert: async () => "created",
      since,
    });
    expect(fetchComments).toHaveBeenCalledWith(since);
  });
});

describe("ingestBatch", () => {
  it("counts created vs existing for a pre-resolved batch", async () => {
    const upsert = vi.fn(async (c: { platformCommentId: string }) =>
      c.platformCommentId === "dup" ? ("existing" as const) : ("created" as const),
    );
    const summary = await ingestBatch(
      [
        { ...comment("new1"), socialAccountId: "a" },
        { ...comment("dup"), socialAccountId: "a" },
      ],
      upsert,
    );
    expect(summary).toEqual({ fetched: 2, created: 1 });
  });
});

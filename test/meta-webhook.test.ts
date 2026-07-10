import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseMetaCommentEvents, verifyMetaSignature } from "@/lib/meta-webhook";

const SECRET = "app_secret_123";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}

describe("verifyMetaSignature", () => {
  it("accepts a correctly signed body", () => {
    const body = '{"hello":"world"}';
    expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = sign('{"hello":"world"}');
    expect(verifyMetaSignature('{"hello":"evil"}', sig, SECRET)).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyMetaSignature("{}", null, SECRET)).toBe(false);
    expect(verifyMetaSignature("{}", "md5=abc", SECRET)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const body = "{}";
    expect(verifyMetaSignature(body, sign(body), "other_secret")).toBe(false);
  });
});

describe("parseMetaCommentEvents", () => {
  it("extracts added-comment events tagged with the page id", () => {
    const payload = {
      entry: [
        {
          id: "page_1",
          time: 1_700_000_000,
          changes: [
            {
              field: "feed",
              value: {
                item: "comment",
                verb: "add",
                comment_id: "c_1",
                message: "great post",
                created_time: 1_700_000_100,
                from: { name: "Alex", id: "u_1" },
              },
            },
          ],
        },
      ],
    };
    const events = parseMetaCommentEvents(payload);
    expect(events).toEqual([
      {
        pageId: "page_1",
        platformCommentId: "c_1",
        authorName: "Alex",
        body: "great post",
        receivedAt: new Date(1_700_000_100 * 1000),
      },
    ]);
  });

  it("ignores non-comment, non-add, and edited events", () => {
    const payload = {
      entry: [
        {
          id: "page_1",
          changes: [
            { field: "feed", value: { item: "like", verb: "add" } },
            { field: "feed", value: { item: "comment", verb: "edited", comment_id: "c_2" } },
            { field: "feed", value: { item: "comment", verb: "remove", comment_id: "c_3" } },
          ],
        },
      ],
    };
    expect(parseMetaCommentEvents(payload)).toEqual([]);
  });

  it("is safe on empty/garbage payloads", () => {
    expect(parseMetaCommentEvents({})).toEqual([]);
    expect(parseMetaCommentEvents(null)).toEqual([]);
    expect(parseMetaCommentEvents({ entry: [{ changes: [] }] })).toEqual([]);
  });
});

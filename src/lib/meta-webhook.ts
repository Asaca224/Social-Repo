import { createHmac, timingSafeEqual } from "node:crypto";
import type { FetchedComment } from "./adapters";

/**
 * Meta webhook helpers (Phase 3 real-time ingestion).
 *
 * Both functions are pure so they can be unit-tested without a live webhook:
 * signature verification (Meta signs the raw body with the app secret) and
 * parsing the Page `feed` change payload into comment events.
 */

/**
 * Verify Meta's `X-Hub-Signature-256` header against the raw request body.
 * Header format is `sha256=<hex hmac>`. Uses a constant-time comparison.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** A comment event parsed from a webhook, tagged with the source Page id. */
export interface MetaCommentEvent extends FetchedComment {
  pageId: string;
}

interface MetaWebhookPayload {
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: Array<{
      field?: string;
      value?: {
        item?: string;
        verb?: string;
        comment_id?: string;
        post_id?: string;
        message?: string;
        created_time?: number;
        from?: { name?: string; id?: string };
      };
    }>;
  }>;
}

/**
 * Extract added-comment events from a Meta Page webhook payload. Ignores edits,
 * deletes, likes, and non-comment feed changes.
 */
export function parseMetaCommentEvents(
  payload: unknown,
): MetaCommentEvent[] {
  const events: MetaCommentEvent[] = [];
  if (typeof payload !== "object" || payload === null) return events;
  const typed = payload as MetaWebhookPayload;

  for (const entry of typed.entry ?? []) {
    const pageId = entry.id;
    if (!pageId) continue;
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (change.field !== "feed" || v?.item !== "comment" || v.verb !== "add") {
        continue;
      }
      if (!v.comment_id) continue;
      events.push({
        pageId,
        platformCommentId: v.comment_id,
        authorName: v.from?.name ?? "Unknown",
        body: v.message ?? "",
        receivedAt: v.created_time
          ? new Date(v.created_time * 1000)
          : new Date(),
      });
    }
  }
  return events;
}

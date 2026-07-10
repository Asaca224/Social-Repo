import { prisma } from "@/lib/db";
import { ingestBatch } from "@/lib/inbox";
import { findAccountByExternalId, prismaUpsertComment } from "@/lib/inbox-store";
import { parseMetaCommentEvents, verifyMetaSignature } from "@/lib/meta-webhook";

export const dynamic = "force-dynamic";

/**
 * Meta webhook subscription verification. Meta issues a GET with
 * hub.mode=subscribe and echoes hub.challenge when hub.verify_token matches the
 * token we configured (META_WEBHOOK_VERIFY_TOKEN).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Real-time comment ingestion. Verifies Meta's signature over the raw body,
 * parses added-comment events, routes each to its connected account, and
 * upserts. Always returns 200 quickly so Meta does not retry needlessly.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    const valid = verifyMetaSignature(
      rawBody,
      request.headers.get("x-hub-signature-256"),
      appSecret,
    );
    if (!valid) return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const events = parseMetaCommentEvents(payload);
  const upsert = prismaUpsertComment(prisma);

  // Resolve each event's Page id to a connected account, then ingest.
  const accountCache = new Map<string, string | null>();
  const resolved: Array<{
    socialAccountId: string;
    platformCommentId: string;
    authorName: string;
    body: string;
    receivedAt: Date;
  }> = [];

  for (const event of events) {
    let accountId = accountCache.get(event.pageId);
    if (accountId === undefined) {
      const account = await findAccountByExternalId(prisma, event.pageId);
      accountId = account?.id ?? null;
      accountCache.set(event.pageId, accountId);
    }
    if (!accountId) continue;
    resolved.push({
      socialAccountId: accountId,
      platformCommentId: event.platformCommentId,
      authorName: event.authorName,
      body: event.body,
      receivedAt: event.receivedAt,
    });
  }

  const summary = await ingestBatch(resolved, upsert);
  return Response.json({ received: events.length, ...summary });
}

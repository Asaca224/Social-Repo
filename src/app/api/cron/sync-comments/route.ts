import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/adapters";
import { decryptToken } from "@/lib/crypto";
import { errorResponse, json } from "@/lib/api";
import { ingestComments } from "@/lib/inbox";
import { prismaUpsertComment } from "@/lib/inbox-store";

export const dynamic = "force-dynamic";

/**
 * Polling fallback for comment ingestion (platforms/accounts without webhooks).
 * Invoked by Vercel Cron. For each connected account, fetch recent comments via
 * the adapter and upsert them. Guarded by CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return errorResponse("CRON_SECRET is not configured", 503);
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return errorResponse("Unauthorized", 401);
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { status: "connected", accessToken: { not: null } },
    select: {
      id: true,
      platform: true,
      externalAccountId: true,
      accessToken: true,
      refreshToken: true,
    },
  });

  const upsert = prismaUpsertComment(prisma);
  let fetched = 0;
  let created = 0;
  const errors: Record<string, string> = {};

  for (const account of accounts) {
    if (!account.accessToken) continue;
    try {
      const adapter = getAdapter(account.platform);
      const creds = {
        externalAccountId: account.externalAccountId,
        accessToken: decryptToken(account.accessToken),
        refreshToken: account.refreshToken ? decryptToken(account.refreshToken) : null,
      };
      const summary = await ingestComments({
        socialAccountId: account.id,
        fetchComments: (since) => adapter.fetchComments(creds, since),
        upsert,
      });
      fetched += summary.fetched;
      created += summary.created;
    } catch (err) {
      errors[account.id] = err instanceof Error ? err.message : "sync failed";
    }
  }

  return json({ accounts: accounts.length, fetched, created, errors });
}

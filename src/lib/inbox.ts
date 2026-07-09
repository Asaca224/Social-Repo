import type { FetchedComment } from "./adapters";

/**
 * Comment ingestion (Phase 3 unified inbox).
 *
 * Both ingestion paths — the polling cron and the Meta webhook — funnel through
 * {@link ingestComments}: given a batch of platform comments, upsert them,
 * deduplicated on (socialAccountId, platformCommentId). Kept injectable so it is
 * unit-tested without a DB.
 */

export type UpsertResult = "created" | "existing";

export interface IngestDeps {
  socialAccountId: string;
  /** Fetch comments from the platform (already bound to account creds). */
  fetchComments: (since?: Date) => Promise<FetchedComment[]>;
  /** Persist one comment; returns whether it was newly created. */
  upsert: (
    comment: FetchedComment & { socialAccountId: string },
  ) => Promise<UpsertResult>;
  since?: Date;
}

export interface IngestSummary {
  fetched: number;
  created: number;
}

export async function ingestComments(deps: IngestDeps): Promise<IngestSummary> {
  const comments = await deps.fetchComments(deps.since);
  let created = 0;
  for (const comment of comments) {
    const result = await deps.upsert({
      ...comment,
      socialAccountId: deps.socialAccountId,
    });
    if (result === "created") created += 1;
  }
  return { fetched: comments.length, created };
}

/**
 * Ingest a pre-parsed batch (e.g. from a webhook payload) that already carries
 * its socialAccountId per comment. Returns counts by processed/created.
 */
export async function ingestBatch(
  comments: Array<FetchedComment & { socialAccountId: string }>,
  upsert: (
    comment: FetchedComment & { socialAccountId: string },
  ) => Promise<UpsertResult>,
): Promise<IngestSummary> {
  let created = 0;
  for (const comment of comments) {
    if ((await upsert(comment)) === "created") created += 1;
  }
  return { fetched: comments.length, created };
}

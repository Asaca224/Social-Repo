import type { PublishOutcome } from "./publish";

/**
 * Due-post publisher (Phase 2 scheduling executor).
 *
 * The MVP schedules posts by persisting `scheduledFor` and letting a Vercel Cron
 * job hit /api/cron/publish-due on an interval; this function is what that
 * endpoint runs. It finds posts whose scheduled time has arrived and publishes
 * each through the normal publish orchestrator.
 *
 * Kept pure/injectable so it's unit-tested without a DB or network. In the
 * production stack this same contract is satisfied by BullMQ delayed jobs
 * instead of a cron scan (see docs/architecture.md).
 */

export interface ScheduleRunnerStore {
  /** Ids of `scheduled` posts whose `scheduledFor` is <= now, capped at limit. */
  findDuePostIds(now: Date, limit: number): Promise<string[]>;
}

export interface ScheduleRunnerDeps {
  store: ScheduleRunnerStore;
  publishOne: (postId: string) => Promise<PublishOutcome>;
  now?: () => Date;
  limit?: number;
}

export interface ScheduleRunSummary {
  processed: number;
  published: number;
  failed: number;
  results: Record<string, string>;
}

export async function runDuePublish(
  deps: ScheduleRunnerDeps,
): Promise<ScheduleRunSummary> {
  const now = deps.now ? deps.now() : new Date();
  const ids = await deps.store.findDuePostIds(now, deps.limit ?? 50);

  const results: Record<string, string> = {};
  let published = 0;
  let failed = 0;

  for (const id of ids) {
    const outcome = await deps.publishOne(id);
    if (outcome.ok) {
      published += 1;
      results[id] = "published";
    } else {
      failed += 1;
      results[id] = outcome.reason;
    }
  }

  return { processed: ids.length, published, failed, results };
}

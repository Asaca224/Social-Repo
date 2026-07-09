import { describe, expect, it, vi } from "vitest";
import { runDuePublish, type ScheduleRunnerStore } from "@/lib/schedule-runner";
import type { PublishOutcome } from "@/lib/publish";

function store(ids: string[]): ScheduleRunnerStore {
  return { findDuePostIds: async () => ids };
}

const ok: PublishOutcome = { ok: true, platformPostIds: { facebook: "1" } };
const fail: PublishOutcome = {
  ok: false,
  reason: "partial_failure",
  platformPostIds: {},
  errors: { facebook: "boom" },
};

describe("runDuePublish", () => {
  it("publishes every due post and tallies results", async () => {
    const publishOne = vi.fn(async () => ok);
    const summary = await runDuePublish({
      store: store(["p1", "p2", "p3"]),
      publishOne,
    });
    expect(publishOne).toHaveBeenCalledTimes(3);
    expect(summary).toEqual({
      processed: 3,
      published: 3,
      failed: 0,
      results: { p1: "published", p2: "published", p3: "published" },
    });
  });

  it("counts failures and records the reason", async () => {
    const publishOne = vi.fn(async (id: string) => (id === "bad" ? fail : ok));
    const summary = await runDuePublish({
      store: store(["good", "bad"]),
      publishOne,
    });
    expect(summary.processed).toBe(2);
    expect(summary.published).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.results.bad).toBe("partial_failure");
  });

  it("does nothing when no posts are due", async () => {
    const publishOne = vi.fn(async () => ok);
    const summary = await runDuePublish({ store: store([]), publishOne });
    expect(publishOne).not.toHaveBeenCalled();
    expect(summary).toEqual({ processed: 0, published: 0, failed: 0, results: {} });
  });

  it("passes the current time and limit to the store", async () => {
    const findDuePostIds = vi.fn(async () => []);
    const fixedNow = new Date("2026-07-09T00:00:00Z");
    await runDuePublish({
      store: { findDuePostIds },
      publishOne: async () => ok,
      now: () => fixedNow,
      limit: 10,
    });
    expect(findDuePostIds).toHaveBeenCalledWith(fixedNow, 10);
  });
});

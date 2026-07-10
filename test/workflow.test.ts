import { describe, expect, it } from "vitest";
import { applyWorkflow } from "@/lib/workflow";

const future = new Date(Date.now() + 60 * 60 * 1000);
const past = new Date(Date.now() - 60 * 60 * 1000);

describe("applyWorkflow", () => {
  it("submits a draft for approval", () => {
    expect(applyWorkflow("draft", { action: "submit" })).toEqual({
      ok: true,
      status: "pending_approval",
      scheduledFor: null,
    });
  });

  it("approves and rejects a pending post", () => {
    expect(applyWorkflow("pending_approval", { action: "approve" })).toMatchObject({
      ok: true,
      status: "approved",
    });
    expect(applyWorkflow("pending_approval", { action: "reject" })).toMatchObject({
      ok: true,
      status: "draft",
    });
  });

  it("schedules an approved post for a future time", () => {
    const res = applyWorkflow("approved", { action: "schedule", scheduledFor: future });
    expect(res).toEqual({ ok: true, status: "scheduled", scheduledFor: future });
  });

  it("refuses to schedule without a time", () => {
    expect(applyWorkflow("approved", { action: "schedule" })).toMatchObject({
      ok: false,
    });
  });

  it("refuses to schedule in the past", () => {
    const res = applyWorkflow("approved", { action: "schedule", scheduledFor: past });
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.reason).toMatch(/future/);
  });

  it("unschedules back to approved and clears the time", () => {
    expect(applyWorkflow("scheduled", { action: "unschedule" })).toEqual({
      ok: true,
      status: "approved",
      scheduledFor: null,
    });
  });

  it("rejects invalid transitions", () => {
    // Can't approve a draft directly.
    expect(applyWorkflow("draft", { action: "approve" })).toMatchObject({ ok: false });
    // Published is terminal.
    expect(applyWorkflow("published", { action: "submit" })).toMatchObject({ ok: false });
    // Can't submit an already-approved post.
    expect(applyWorkflow("approved", { action: "submit" })).toMatchObject({ ok: false });
  });

  it("allows a failed post to be rescheduled", () => {
    expect(
      applyWorkflow("failed", { action: "schedule", scheduledFor: future }),
    ).toMatchObject({ ok: true, status: "scheduled" });
  });
});

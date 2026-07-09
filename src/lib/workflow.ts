import type { PostStatus } from "@prisma/client";

/**
 * Approval / scheduling state machine for posts (Phase 2).
 *
 * The review lifecycle is: draft → pending_approval → approved → scheduled,
 * with rejections falling back to draft. Immediate manual publishing is a
 * separate action (see src/lib/publish.ts); the `published`/`failed` states are
 * reached there, not through this machine.
 *
 * This is a pure function so every transition is unit-tested without a DB.
 */

export type WorkflowAction =
  | "submit" // draft → pending_approval
  | "approve" // pending_approval → approved
  | "reject" // pending_approval/approved → draft
  | "schedule" // draft/approved/failed → scheduled (requires future scheduledFor)
  | "unschedule"; // scheduled → approved

const NEXT: Partial<
  Record<PostStatus, Partial<Record<WorkflowAction, PostStatus>>>
> = {
  draft: { submit: "pending_approval", schedule: "scheduled" },
  pending_approval: { approve: "approved", reject: "draft" },
  approved: { schedule: "scheduled", reject: "draft" },
  scheduled: { unschedule: "approved" },
  failed: { schedule: "scheduled", reject: "draft" },
};

export interface WorkflowInput {
  action: WorkflowAction;
  scheduledFor?: Date | null;
  now?: () => Date;
}

export type WorkflowResult =
  | { ok: true; status: PostStatus; scheduledFor: Date | null }
  | { ok: false; reason: string };

export function applyWorkflow(
  current: PostStatus,
  input: WorkflowInput,
): WorkflowResult {
  const target = NEXT[current]?.[input.action];
  if (!target) {
    return {
      ok: false,
      reason: `cannot '${input.action}' a post in status '${current}'`,
    };
  }

  if (input.action === "schedule") {
    const now = input.now ?? (() => new Date());
    if (!input.scheduledFor) {
      return { ok: false, reason: "scheduledFor is required to schedule" };
    }
    if (input.scheduledFor.getTime() <= now().getTime()) {
      return { ok: false, reason: "scheduledFor must be in the future" };
    }
    return { ok: true, status: target, scheduledFor: input.scheduledFor };
  }

  // Every non-schedule transition clears any pending schedule time.
  return { ok: true, status: target, scheduledFor: null };
}

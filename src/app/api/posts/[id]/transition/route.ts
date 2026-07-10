import { z } from "zod";
import { prisma } from "@/lib/db";
import { errorResponse, json, zodErrorResponse } from "@/lib/api";
import { resolveTenant } from "@/lib/auth";
import { applyWorkflow } from "@/lib/workflow";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["submit", "approve", "reject", "schedule", "unschedule"]),
  scheduledFor: z.string().datetime().optional(),
});

/**
 * Move a post through the approval / scheduling workflow. The allowed
 * transitions live in src/lib/workflow.ts; this route resolves the tenant,
 * loads the (tenant-scoped) post, applies the transition, and persists it.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const post = await prisma.post.findFirst({
    where: { id: params.id, client: { agencyId: ctx.agencyId } },
    select: { id: true, status: true },
  });
  if (!post) return errorResponse("Post not found", 404);

  const result = applyWorkflow(post.status, {
    action: parsed.data.action,
    scheduledFor: parsed.data.scheduledFor
      ? new Date(parsed.data.scheduledFor)
      : undefined,
  });
  if (!result.ok) {
    return json({ error: result.reason }, { status: 409 });
  }

  const updated = await prisma.post.update({
    where: { id: post.id },
    data: { status: result.status, scheduledFor: result.scheduledFor },
    select: { id: true, status: true, scheduledFor: true },
  });
  return json({ post: updated });
}

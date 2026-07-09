import { z } from "zod";
import { prisma } from "@/lib/db";
import { errorResponse, json, zodErrorResponse } from "@/lib/api";
import { resolveTenant } from "@/lib/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // null unassigns.
  assignedTo: z.string().min(1).nullable(),
});

/** Assign (or unassign) a comment to a team member. Tenant-scoped. */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const comment = await prisma.comment.findFirst({
    where: { id: params.id, socialAccount: { client: { agencyId: ctx.agencyId } } },
    select: { id: true },
  });
  if (!comment) return errorResponse("Comment not found", 404);

  // If assigning, ensure the user belongs to this agency.
  if (parsed.data.assignedTo) {
    const user = await prisma.user.findFirst({
      where: { id: parsed.data.assignedTo, agencyId: ctx.agencyId },
      select: { id: true },
    });
    if (!user) return errorResponse("Assignee not found in this agency", 422);
  }

  const updated = await prisma.comment.update({
    where: { id: comment.id },
    data: { assignedTo: parsed.data.assignedTo },
    select: { id: true, assignedTo: true, status: true },
  });
  return json({ comment: updated });
}

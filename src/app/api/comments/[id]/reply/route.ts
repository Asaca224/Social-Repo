import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/adapters";
import { decryptToken } from "@/lib/crypto";
import { errorResponse, json, zodErrorResponse } from "@/lib/api";
import { resolveTenant } from "@/lib/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  body: z.string().min(1).max(8000),
  sentBy: z.string().min(1).optional(),
  aiGenerated: z.boolean().optional(),
});

/**
 * Send a reply to a comment via the platform adapter, then persist it and mark
 * the comment replied. Tenant-scoped through the comment's account → client.
 */
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
    select: {
      id: true,
      platformCommentId: true,
      socialAccount: {
        select: {
          platform: true,
          externalAccountId: true,
          accessToken: true,
          refreshToken: true,
        },
      },
    },
  });
  if (!comment) return errorResponse("Comment not found", 404);

  const account = comment.socialAccount;
  if (!account.accessToken) {
    return errorResponse("Account is not connected (missing token)", 409);
  }

  try {
    const adapter = getAdapter(account.platform);
    const result = await adapter.replyToComment(
      {
        externalAccountId: account.externalAccountId,
        accessToken: decryptToken(account.accessToken),
        refreshToken: account.refreshToken ? decryptToken(account.refreshToken) : null,
      },
      { platformCommentId: comment.platformCommentId, body: parsed.data.body },
    );

    const reply = await prisma.reply.create({
      data: {
        commentId: comment.id,
        body: parsed.data.body,
        sentBy: parsed.data.sentBy ?? null,
        aiGenerated: parsed.data.aiGenerated ?? false,
        sentAt: new Date(),
      },
      select: { id: true, body: true, sentAt: true, aiGenerated: true },
    });
    await prisma.comment.update({
      where: { id: comment.id },
      data: { status: "replied" },
    });

    return json({ reply, platformReplyId: result.platformReplyId }, { status: 201 });
  } catch (err) {
    return json(
      { error: "Failed to send reply", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}

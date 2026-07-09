import { prisma } from "@/lib/db";
import { errorResponse, json } from "@/lib/api";
import { resolveTenant } from "@/lib/auth";
import { classifySentiment } from "@/lib/ai";
import { getLLM } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

/**
 * Classify a comment's sentiment (positive/neutral/negative) and persist it.
 * Negative comments can then be surfaced for priority response in the inbox.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const llm = getLLM();
  if (!llm) return errorResponse("AI is not configured (ANTHROPIC_API_KEY)", 503);

  const comment = await prisma.comment.findFirst({
    where: { id: params.id, socialAccount: { client: { agencyId: ctx.agencyId } } },
    select: { id: true, body: true },
  });
  if (!comment) return errorResponse("Comment not found", 404);

  try {
    const sentiment = await classifySentiment(llm, comment.body);
    const updated = await prisma.comment.update({
      where: { id: comment.id },
      data: { sentiment },
      select: { id: true, sentiment: true },
    });
    return json({ comment: updated });
  } catch (err) {
    return json(
      { error: "Classification failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}

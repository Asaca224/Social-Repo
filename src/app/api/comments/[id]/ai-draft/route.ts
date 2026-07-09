import { prisma } from "@/lib/db";
import { errorResponse, json } from "@/lib/api";
import { resolveTenant } from "@/lib/auth";
import { draftReply } from "@/lib/ai";
import { getLLM } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

/**
 * Return an AI-drafted reply suggestion for a comment. Does NOT send — the
 * draft is returned for a human to review and send via the reply endpoint
 * (AI drafts, human sends).
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
    select: {
      authorName: true,
      body: true,
      socialAccount: {
        select: { client: { select: { brandingConfig: true } } },
      },
    },
  });
  if (!comment) return errorResponse("Comment not found", 404);

  // brand voice may live in the client's branding config (optional).
  const branding = comment.socialAccount.client.brandingConfig as
    | { voice?: string }
    | null;

  try {
    const draft = await draftReply(llm, {
      commentBody: comment.body,
      authorName: comment.authorName,
      brandVoice: branding?.voice,
    });
    return json({ draft, aiGenerated: true });
  } catch (err) {
    return json(
      { error: "AI draft failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}

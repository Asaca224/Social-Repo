import { prisma } from "@/lib/db";
import { getClientForTenant } from "@/lib/tenancy";
import { errorResponse } from "@/lib/api";
import { resolveTenant } from "@/lib/auth";
import { getLLM, REPORT_MODEL } from "@/lib/anthropic";
import {
  buildReportModel,
  renderReportHtml,
  summarizeReport,
  type BrandingConfig,
} from "@/lib/report";

export const dynamic = "force-dynamic";

/**
 * White-labeled performance report for a client over a date range. Returns
 * print-ready HTML branded with the client's config. Add `?summary=1` to
 * include an AI-written summary (Claude Sonnet); requires ANTHROPIC_API_KEY.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const client = await getClientForTenant(ctx, params.id);
  if (!client) return errorResponse("Client not found", 404);

  const url = new URL(request.url);
  const to = url.searchParams.get("to")
    ? new Date(url.searchParams.get("to") as string)
    : new Date();
  const from = url.searchParams.get("from")
    ? new Date(url.searchParams.get("from") as string)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: {
      socialAccount: { clientId: params.id },
      date: { gte: from, lte: to },
    },
    select: { date: true, followers: true, impressions: true, engagementRate: true },
    orderBy: { date: "asc" },
  });

  const model = buildReportModel(snapshots, { from, to });
  const branding = (client.brandingConfig as BrandingConfig | null) ?? {};

  let aiSummary: string | undefined;
  if (url.searchParams.get("summary") === "1") {
    const llm = getLLM(REPORT_MODEL);
    if (llm) {
      try {
        aiSummary = await summarizeReport(llm, model);
      } catch {
        // Non-fatal: fall back to a report without the AI narrative.
      }
    }
  }

  const html = renderReportHtml(model, branding, aiSummary);
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

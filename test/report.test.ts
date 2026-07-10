import { describe, expect, it, vi } from "vitest";
import {
  buildReportModel,
  renderReportHtml,
  summarizeReport,
  type Snapshot,
} from "@/lib/report";
import type { LLM } from "@/lib/ai";

const range = {
  from: new Date("2026-06-01"),
  to: new Date("2026-06-30"),
};

const snapshots: Snapshot[] = [
  { date: new Date("2026-06-10"), followers: 1000, impressions: 500, engagementRate: 0.02 },
  { date: new Date("2026-06-01"), followers: 900, impressions: 300, engagementRate: 0.04 },
  { date: new Date("2026-06-20"), followers: 1200, impressions: 700, engagementRate: null },
];

describe("buildReportModel", () => {
  it("aggregates growth, impressions, and engagement in date order", () => {
    const model = buildReportModel(snapshots, range);
    expect(model.followersStart).toBe(900); // earliest date
    expect(model.followersEnd).toBe(1200); // latest date
    expect(model.followerGrowth).toBe(300);
    expect(model.totalImpressions).toBe(1500);
    expect(model.avgEngagementRate).toBeCloseTo(0.03); // (0.02 + 0.04) / 2
    expect(model.points).toBe(3);
  });

  it("handles an empty snapshot set", () => {
    const model = buildReportModel([], range);
    expect(model).toMatchObject({
      followersStart: 0,
      followerGrowth: 0,
      totalImpressions: 0,
      avgEngagementRate: 0,
      points: 0,
    });
  });
});

describe("renderReportHtml", () => {
  it("is white-labeled with branding and escapes untrusted values", () => {
    const model = buildReportModel(snapshots, range);
    const html = renderReportHtml(model, {
      companyName: "Acme <script>",
      primaryColor: "#123456",
      logoUrl: "https://cdn.example.com/logo.png",
    });
    expect(html).toContain("#123456");
    expect(html).toContain("https://cdn.example.com/logo.png");
    // company name is escaped, not injected raw
    expect(html).toContain("Acme &lt;script&gt;");
    expect(html).not.toContain("Acme <script>");
    // metrics rendered
    expect(html).toContain("+300");
    expect(html).toContain("1,500");
  });

  it("includes the AI summary when provided", () => {
    const model = buildReportModel(snapshots, range);
    const html = renderReportHtml(model, {}, "Followers grew 33% this month.");
    expect(html).toContain("Summary");
    expect(html).toContain("Followers grew 33% this month.");
  });
});

describe("summarizeReport", () => {
  it("passes the metrics to the LLM and trims the result", async () => {
    const llm: LLM = { complete: vi.fn(async () => "  Strong month.  ") };
    const model = buildReportModel(snapshots, range);
    const summary = await summarizeReport(llm, model);
    expect(summary).toBe("Strong month.");
    const call = (llm.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(call.prompt).toContain("Follower growth: 300");
  });
});

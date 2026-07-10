import { getEnv } from "@/lib/env";
import type {
  AdapterCredentials,
  AnalyticsPoint,
  DateRange,
  FetchedComment,
  PlatformAdapter,
  PublishRequest,
  PublishResult,
  ReplyRequest,
  ReplyResult,
} from "./types";
import { PlatformError } from "./types";

interface GraphErrorBody {
  error?: { message?: string; code?: number; type?: string };
}

/**
 * Meta (Facebook + Instagram) adapter — Phase 1 target platform.
 *
 * Makes live Facebook Graph API calls. Callers pass already-decrypted
 * credentials (see src/lib/publish.ts); this class does pure platform I/O and
 * never touches the database or tenancy.
 *
 * Note: `externalAccountId` is the Facebook Page id, and `accessToken` is the
 * Page access token. Instagram publishing uses a different two-step flow and is
 * added when the IG account link lands; for now `instagram` targets are routed
 * here for the shared Graph plumbing but publish via the Page.
 */
export class MetaAdapter implements PlatformAdapter {
  readonly platform = "facebook" as const;

  private get graphBaseUrl(): string {
    const { META_GRAPH_API_VERSION } = getEnv();
    return `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
  }

  /** Low-level Graph request. Throws {@link PlatformError} on any failure. */
  private async graph<T>(
    path: string,
    init: { method: "GET" | "POST"; accessToken: string; params?: Record<string, string> },
  ): Promise<T> {
    const url = new URL(`${this.graphBaseUrl}/${path.replace(/^\//, "")}`);
    const params = { access_token: init.accessToken, ...(init.params ?? {}) };

    let res: Response;
    try {
      if (init.method === "GET") {
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
        res = await fetch(url, { method: "GET" });
      } else {
        const form = new URLSearchParams(params);
        res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: form,
        });
      }
    } catch (err) {
      throw new PlatformError(
        this.platform,
        err instanceof Error ? err.message : "network request failed",
      );
    }

    const body = (await res.json().catch(() => ({}))) as T & GraphErrorBody;
    if (!res.ok || body.error) {
      throw new PlatformError(
        this.platform,
        body.error?.message ?? `HTTP ${res.status}`,
        res.status,
        body.error?.code,
      );
    }
    return body as T;
  }

  async publishPost(
    creds: AdapterCredentials,
    request: PublishRequest,
  ): Promise<PublishResult> {
    const pageId = creds.externalAccountId;

    // Single image → /photos with a caption; text/link → /feed.
    if (request.mediaUrls.length === 1) {
      const photo = request.mediaUrls[0] as string;
      const result = await this.graph<{ id: string; post_id?: string }>(
        `${pageId}/photos`,
        {
          method: "POST",
          accessToken: creds.accessToken,
          params: { url: photo, caption: request.content },
        },
      );
      return { platformPostId: result.post_id ?? result.id };
    }

    const result = await this.graph<{ id: string }>(`${pageId}/feed`, {
      method: "POST",
      accessToken: creds.accessToken,
      params: { message: request.content },
    });
    return { platformPostId: result.id };
  }

  async fetchComments(
    creds: AdapterCredentials,
    since?: Date,
  ): Promise<FetchedComment[]> {
    const params: Record<string, string> = {
      fields: "id,from{name},message,created_time",
    };
    if (since) params.since = Math.floor(since.getTime() / 1000).toString();

    const result = await this.graph<{
      data?: Array<{
        id: string;
        from?: { name?: string };
        message?: string;
        created_time?: string;
      }>;
    }>(`${creds.externalAccountId}/comments`, {
      method: "GET",
      accessToken: creds.accessToken,
      params,
    });

    return (result.data ?? []).map((c) => ({
      platformCommentId: c.id,
      authorName: c.from?.name ?? "Unknown",
      body: c.message ?? "",
      receivedAt: c.created_time ? new Date(c.created_time) : new Date(),
    }));
  }

  async replyToComment(
    creds: AdapterCredentials,
    request: ReplyRequest,
  ): Promise<ReplyResult> {
    const result = await this.graph<{ id: string }>(
      `${request.platformCommentId}/comments`,
      {
        method: "POST",
        accessToken: creds.accessToken,
        params: { message: request.body },
      },
    );
    return { platformReplyId: result.id };
  }

  async fetchAnalytics(
    creds: AdapterCredentials,
    range: DateRange,
  ): Promise<AnalyticsPoint[]> {
    const result = await this.graph<{
      data?: Array<{
        name: string;
        values?: Array<{ value: number; end_time?: string }>;
      }>;
    }>(`${creds.externalAccountId}/insights`, {
      method: "GET",
      accessToken: creds.accessToken,
      params: {
        metric: "page_impressions,page_fans",
        since: Math.floor(range.from.getTime() / 1000).toString(),
        until: Math.floor(range.to.getTime() / 1000).toString(),
      },
    });

    // Fold the metric-oriented Graph response into date-oriented points.
    const byDate = new Map<string, AnalyticsPoint>();
    for (const metric of result.data ?? []) {
      for (const v of metric.values ?? []) {
        const key = (v.end_time ?? new Date().toISOString()).slice(0, 10);
        const point = byDate.get(key) ?? { date: new Date(key) };
        if (metric.name === "page_impressions") point.impressions = v.value;
        if (metric.name === "page_fans") point.followers = v.value;
        byDate.set(key, point);
      }
    }
    return [...byDate.values()];
  }
}

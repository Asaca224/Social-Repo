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
import { NotImplementedError, PlatformError } from "./types";

interface GraphErrorBody {
  error?: { message?: string; code?: number };
}

/**
 * Instagram adapter (Business / Creator accounts only).
 *
 * Instagram publishing is a distinct two-step flow on the Graph API — create a
 * media container, then publish it — unlike Facebook's single /feed POST. The
 * account's `externalAccountId` is the IG *user id* (the Instagram Business
 * account linked to a Facebook Page), and `accessToken` is the Page token.
 *
 * Personal accounts have no publishing/management API (Basic Display was shut
 * down Dec 2024), so they never reach this adapter — the connect endpoint
 * rejects them.
 */
export class InstagramAdapter implements PlatformAdapter {
  readonly platform = "instagram" as const;

  private get graphBaseUrl(): string {
    const { META_GRAPH_API_VERSION } = getEnv();
    return `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
  }

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
        res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(params),
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
    // Instagram feed posts must include media; text-only isn't allowed.
    const image = request.mediaUrls[0];
    if (!image) {
      throw new PlatformError(
        this.platform,
        "Instagram posts require an image or video URL.",
      );
    }
    const igUserId = creds.externalAccountId;

    // 1) Create a media container.
    const container = await this.graph<{ id: string }>(`${igUserId}/media`, {
      method: "POST",
      accessToken: creds.accessToken,
      params: { image_url: image, caption: request.content },
    });

    // 2) Publish the container.
    const published = await this.graph<{ id: string }>(`${igUserId}/media_publish`, {
      method: "POST",
      accessToken: creds.accessToken,
      params: { creation_id: container.id },
    });

    return { platformPostId: published.id };
  }

  async replyToComment(
    creds: AdapterCredentials,
    request: ReplyRequest,
  ): Promise<ReplyResult> {
    // IG replies go to the comment's /replies edge.
    const result = await this.graph<{ id: string }>(
      `${request.platformCommentId}/replies`,
      {
        method: "POST",
        accessToken: creds.accessToken,
        params: { message: request.body },
      },
    );
    return { platformReplyId: result.id };
  }

  async fetchComments(
    _creds: AdapterCredentials,
    _since?: Date,
  ): Promise<FetchedComment[]> {
    // IG comments are per-media; ingestion is added with the inbox work for IG.
    throw new NotImplementedError(this.platform, "fetchComments");
  }

  async fetchAnalytics(
    _creds: AdapterCredentials,
    _range: DateRange,
  ): Promise<AnalyticsPoint[]> {
    throw new NotImplementedError(this.platform, "fetchAnalytics");
  }
}

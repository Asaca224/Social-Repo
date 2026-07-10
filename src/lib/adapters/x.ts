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

/**
 * X (Twitter) adapter — added in Phase 4.
 *
 * Publishing and replies use the X API v2 with an OAuth2 user access token
 * (passed already-decrypted in `creds`). Comment/mention ingestion and analytics
 * use different v2 endpoints with their own pagination/entitlement rules and are
 * deferred to the inbox/analytics work for X specifically.
 */
export class XAdapter implements PlatformAdapter {
  readonly platform = "x" as const;
  private readonly baseUrl = "https://api.twitter.com/2";

  private async api<T>(
    path: string,
    init: { method: "POST" | "GET"; accessToken: string; body?: unknown },
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/${path}`, {
        method: init.method,
        headers: {
          authorization: `Bearer ${init.accessToken}`,
          "content-type": "application/json",
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
    } catch (err) {
      throw new PlatformError(
        this.platform,
        err instanceof Error ? err.message : "network request failed",
      );
    }
    const body = (await res.json().catch(() => ({}))) as {
      data?: T;
      title?: string;
      detail?: string;
    };
    if (!res.ok) {
      throw new PlatformError(
        this.platform,
        body.detail ?? body.title ?? `HTTP ${res.status}`,
        res.status,
      );
    }
    return body.data as T;
  }

  async publishPost(
    creds: AdapterCredentials,
    request: PublishRequest,
  ): Promise<PublishResult> {
    // Media upload is a separate v1.1 flow; Phase 4 posts text.
    const data = await this.api<{ id: string }>("tweets", {
      method: "POST",
      accessToken: creds.accessToken,
      body: { text: request.content },
    });
    return { platformPostId: data.id };
  }

  async replyToComment(
    creds: AdapterCredentials,
    request: ReplyRequest,
  ): Promise<ReplyResult> {
    const data = await this.api<{ id: string }>("tweets", {
      method: "POST",
      accessToken: creds.accessToken,
      body: {
        text: request.body,
        reply: { in_reply_to_tweet_id: request.platformCommentId },
      },
    });
    return { platformReplyId: data.id };
  }

  async fetchComments(
    _creds: AdapterCredentials,
    _since?: Date,
  ): Promise<FetchedComment[]> {
    throw new NotImplementedError(this.platform, "fetchComments");
  }

  async fetchAnalytics(
    _creds: AdapterCredentials,
    _range: DateRange,
  ): Promise<AnalyticsPoint[]> {
    throw new NotImplementedError(this.platform, "fetchAnalytics");
  }
}

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
 * LinkedIn adapter — added in Phase 4.
 *
 * Publishing uses the UGC Posts API with an OAuth2 access token. The account's
 * `externalAccountId` is the author URN (e.g. `urn:li:person:xxxx` or
 * `urn:li:organization:xxxx`). Comment ingestion and analytics use separate
 * endpoints and are deferred.
 */
export class LinkedInAdapter implements PlatformAdapter {
  readonly platform = "linkedin" as const;
  private readonly baseUrl = "https://api.linkedin.com/v2";

  async publishPost(
    creds: AdapterCredentials,
    request: PublishRequest,
  ): Promise<PublishResult> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/ugcPosts`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${creds.accessToken}`,
          "content-type": "application/json",
          "x-restli-protocol-version": "2.0.0",
        },
        body: JSON.stringify({
          author: creds.externalAccountId,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: request.content },
              shareMediaCategory: "NONE",
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
          },
        }),
      });
    } catch (err) {
      throw new PlatformError(
        this.platform,
        err instanceof Error ? err.message : "network request failed",
      );
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new PlatformError(
        this.platform,
        body.message ?? `HTTP ${res.status}`,
        res.status,
      );
    }
    // LinkedIn returns the post URN in the X-RestLi-Id header (and body id).
    const headerId = res.headers.get("x-restli-id");
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { platformPostId: headerId ?? body.id ?? "" };
  }

  async replyToComment(
    _creds: AdapterCredentials,
    _request: ReplyRequest,
  ): Promise<ReplyResult> {
    throw new NotImplementedError(this.platform, "replyToComment");
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

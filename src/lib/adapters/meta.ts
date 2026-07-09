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
import { NotImplementedError } from "./types";

/**
 * Meta (Facebook + Instagram) adapter — Phase 1 target platform.
 *
 * This is a STUB. The method bodies show the intended Graph API shape but do not
 * make live calls yet; wiring real requests (and OAuth token exchange) is the
 * first coding task of Phase 1 proper. Keeping the surface here lets the rest of
 * the app compile and depend on the adapter contract today.
 */
export class MetaAdapter implements PlatformAdapter {
  // Covers both Facebook Pages and Instagram business accounts via Graph API.
  readonly platform = "facebook" as const;

  private get graphBaseUrl(): string {
    const { META_GRAPH_API_VERSION } = getEnv();
    return `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
  }

  async publishPost(
    _creds: AdapterCredentials,
    _request: PublishRequest,
  ): Promise<PublishResult> {
    // Real impl: POST {graphBaseUrl}/{pageId}/feed (FB) or the two-step
    // /media + /media_publish flow (IG), authenticated with the page token.
    throw new NotImplementedError(this.platform, "publishPost");
  }

  async fetchComments(
    _creds: AdapterCredentials,
    _since?: Date,
  ): Promise<FetchedComment[]> {
    // Real impl: GET {graphBaseUrl}/{objectId}/comments, or ingest via the
    // Meta webhook subscription where available.
    throw new NotImplementedError(this.platform, "fetchComments");
  }

  async replyToComment(
    _creds: AdapterCredentials,
    _request: ReplyRequest,
  ): Promise<ReplyResult> {
    // Real impl: POST {graphBaseUrl}/{commentId}/comments with the reply body.
    throw new NotImplementedError(this.platform, "replyToComment");
  }

  async fetchAnalytics(
    _creds: AdapterCredentials,
    _range: DateRange,
  ): Promise<AnalyticsPoint[]> {
    // Real impl: GET {graphBaseUrl}/{objectId}/insights with metric + period.
    throw new NotImplementedError(this.platform, "fetchAnalytics");
  }
}

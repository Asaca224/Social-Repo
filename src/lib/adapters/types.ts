import type { Platform } from "@prisma/client";

/**
 * PlatformAdapter isolates each social platform's messy, ever-changing API from
 * core business logic. Every platform (Meta, X, LinkedIn, TikTok, ...) ships one
 * concrete implementation of this interface; core code depends only on the
 * interface. See docs/architecture.md.
 *
 * Implementations should be pure I/O against the platform: no tenancy checks, no
 * database writes. Rate limiting, retries, and persistence live in the calling
 * layer (queue workers in the production stack).
 */

/** A connected account's credentials, already decrypted by the caller. */
export interface AdapterCredentials {
  externalAccountId: string;
  accessToken: string;
  refreshToken?: string | null;
}

/** Platform-neutral post payload handed to an adapter for publishing. */
export interface PublishRequest {
  content: string;
  mediaUrls: string[];
}

export interface PublishResult {
  /** External id assigned by the platform (e.g. Meta post id). */
  platformPostId: string;
  permalink?: string;
}

export interface FetchedComment {
  platformCommentId: string;
  authorName: string;
  body: string;
  receivedAt: Date;
}

export interface ReplyRequest {
  platformCommentId: string;
  body: string;
}

export interface ReplyResult {
  platformReplyId: string;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface AnalyticsPoint {
  date: Date;
  followers?: number;
  impressions?: number;
  engagementRate?: number;
  raw?: unknown;
}

export interface PlatformAdapter {
  readonly platform: Platform;

  publishPost(
    creds: AdapterCredentials,
    request: PublishRequest,
  ): Promise<PublishResult>;

  fetchComments(
    creds: AdapterCredentials,
    since?: Date,
  ): Promise<FetchedComment[]>;

  replyToComment(
    creds: AdapterCredentials,
    request: ReplyRequest,
  ): Promise<ReplyResult>;

  fetchAnalytics(
    creds: AdapterCredentials,
    range: DateRange,
  ): Promise<AnalyticsPoint[]>;
}

/** Thrown by adapters when a platform integration is not yet implemented. */
export class NotImplementedError extends Error {
  constructor(platform: Platform, method: string) {
    super(`${platform} adapter: ${method}() is not implemented yet`);
    this.name = "NotImplementedError";
  }
}

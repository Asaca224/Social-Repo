# Architecture Notes

## Adapter pattern per platform

Build a `PlatformAdapter` interface and one concrete implementation per platform:

```
interface PlatformAdapter {
  publishPost(post): PlatformPostResult
  fetchComments(account): Comment[]
  replyToComment(comment, body): ReplyResult
  fetchAnalytics(account, dateRange): AnalyticsSnapshot[]
}
```

This isolates the messy, ever-changing platform APIs from core business logic —
critical since Meta / X / TikTok APIs change frequently and have different rate
limits. Core code depends only on the interface; swapping or fixing a platform
never touches business logic.

## Queue everything that talks to an external API

Publishing and comment-sync must **never** be synchronous HTTP calls from the
dashboard. Use BullMQ jobs with:

- per-platform rate limiting,
- retry with backoff,
- per-platform concurrency windows.

The dashboard enqueues; workers do the external I/O.

## Token refresh service

A scheduled worker proactively refreshes OAuth tokens **before** expiry, with
alerting when a client's account needs re-auth. Account status transitions to
`needs_reauth` so the UI can prompt the client to reconnect.

## Webhook ingestion

Meta and X support webhooks for real-time comments/mentions — use these instead
of polling where available, and fall back to polling for platforms without
webhooks. The `PlatformAdapter` boundary lets each platform pick its own
ingestion strategy without leaking into core code.

## Encrypt tokens at rest

Access and refresh tokens are credential data for **other people's businesses**.
Encrypt them at rest (KMS or app-level encryption). Never log raw tokens; never
return them to the client.

## MVP → scale migration

The MVP relies on Vercel Cron + (optionally) Upstash QStash; the production stack
moves to dedicated NestJS workers with BullMQ + managed Redis. Because both sides
consume the same `PlatformAdapter` interface and the same data model, this is a
hosting/infra swap rather than a rewrite.

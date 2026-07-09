# Product Vision & Feature Set

## Vision

A single dashboard for an agency (or in-house team) to manage **many client
companies' social accounts**: scheduling/publishing posts, replying to
comments/DMs across platforms, and reporting performance — with per-client
permissions and white-label branding.

Think Hootsuite / Sprout Social, but built to a specific way of working:
Node.js, AI-assisted triage, and clean rules-based automation.

---

## 1. Account & Org Management (Multi-Tenancy)

- **Agency** (top level) → **Client Workspaces** (e.g. "Criscione Electric," "Chalansa Claremont") → **Social Accounts** (IG, FB, X, LinkedIn, TikTok, Google Business Profile).
- Role-based access: **Agency Admin**, **Account Manager**, **Client Viewer**, **Client Approver**.
- Client-facing login (view-only or approve-only mode) — clients can approve posts before they go live.

## 2. Publishing

- Multi-platform composer (one post → adapted per platform: character limits, image ratios, hashtags).
- Content calendar (drag-and-drop scheduling).
- Approval workflows: draft → internal review → client approval → scheduled → published.
- Bulk upload / CSV import for content batches.
- Evergreen / recurring post queues.
- Media library per client (images, video, brand assets).

## 3. Unified Inbox (Comments & DMs)

- Pull comments, mentions, and DMs from all connected accounts into one feed.
- Assign comments to team members.
- Canned responses / saved replies per client.
- AI-drafted reply suggestions (Claude Haiku) with human approval before sending.
- Sentiment flagging (auto-flag negative comments for priority response).
- SLA timers (e.g. "respond within 2 hours").

## 4. Analytics & Reporting

- Per-client dashboards: engagement, follower growth, best-performing posts.
- White-label PDF / branded reports for clients (auto-generated weekly/monthly).
- Cross-client agency rollup view.

## 5. Billing (SaaS Layer)

- Stripe subscription tiers (by # of connected accounts / seats / clients).
- Usage-based add-ons (extra accounts, AI reply credits).
- Client sub-billing — agency bills its own clients (optional reseller mode).

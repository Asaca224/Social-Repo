# SocialOps

> Multi-tenant social media management SaaS — one dashboard for an agency (or in-house team) to manage many client companies' social accounts: scheduling/publishing posts, replying to comments and DMs across platforms, and reporting performance, with per-client permissions and white-label branding.

Think Hootsuite / Sprout Social, but purpose-built: Node.js, AI-assisted triage, and clean rules-based automation.

---

## Status

**Phase 0 — Specification.** This repository currently contains the product and
architecture specification only. No application code has landed yet. See the
[roadmap](docs/roadmap.md) for the path from MVP to V1.

## Documentation

| Document | What's in it |
|---|---|
| [Product Vision & Features](docs/product.md) | Core feature set: multi-tenancy, publishing, unified inbox, analytics, billing |
| [Tech Stack](docs/tech-stack.md) | MVP (free-tier) stack and the production/scale stack |
| [Data Model](docs/data-model.md) | Core tables and relationships |
| [Architecture](docs/architecture.md) | Adapter pattern, queueing, token refresh, webhooks, encryption |
| [Build Roadmap](docs/roadmap.md) | Phase 1 → V1 delivery plan |
| [Open Decisions](docs/open-decisions.md) | Choices to nail down before writing code |

## Product at a glance

- **Multi-tenancy:** Agency → Client Workspaces → Social Accounts, with role-based access and a client-facing approval portal.
- **Publishing:** Multi-platform composer, content calendar, approval workflows, bulk/CSV import, evergreen queues, per-client media library.
- **Unified inbox:** Comments, mentions, and DMs from every connected account in one feed, with assignment, canned responses, AI-drafted replies (human-approved), sentiment flagging, and SLA timers.
- **Analytics:** Per-client dashboards, white-label PDF reports, cross-client agency rollups.
- **Billing:** Stripe subscription tiers, usage-based add-ons, optional agency-bills-its-clients reseller mode.

## Design principles

1. **Isolate every platform behind a `PlatformAdapter` interface.** Meta / X / TikTok APIs change constantly and differ in rate limits — keep that mess out of core business logic. See [Architecture](docs/architecture.md).
2. **Queue everything that talks to an external API.** Publishing and comment-sync are never synchronous HTTP calls from the dashboard.
3. **Encrypt tokens at rest.** These are credentials for other people's businesses.
4. **Human-in-the-loop AI for V1.** AI drafts replies; a person sends them. Full autonomy is a later, trust-building phase.

## The MVP → scale story

The MVP stack (Vercel + Neon + Prisma + Clerk + Vercel Cron) and the production
stack (dedicated workers + BullMQ + managed Redis + S3) **share the same data
model and adapter interfaces**. Migrating later is a hosting/infra change, not a
rewrite.

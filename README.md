# SocialOps

> Multi-tenant social media management SaaS — one dashboard for an agency (or in-house team) to manage many client companies' social accounts: scheduling/publishing posts, replying to comments and DMs across platforms, and reporting performance, with per-client permissions and white-label branding.

Think Hootsuite / Sprout Social, but purpose-built: Node.js, AI-assisted triage, and clean rules-based automation.

---

## Status

**Phases 1–3 — Foundation, publish, auth, scheduling, unified inbox.** A running
Next.js app with the full Prisma data model, the `PlatformAdapter` interface with
a **live Meta (FB/IG) adapter**, at-rest token encryption, tenant-scoping
helpers, end-to-end **manual publish**, **Clerk auth** (gated — header fallback
in dev), an **approval workflow** (draft → pending → approved → scheduled),
**scheduled publishing** via a cron-driven due-post scanner, a **content
calendar**, and a **unified inbox**: comment ingestion by Meta **webhook**
(signature-verified) with a **polling cron** fallback, plus reply sending,
assignment, and canned responses. Adding X/LinkedIn adapters and AI-drafted
replies is the next phase — see the [roadmap](docs/roadmap.md).

## Getting started

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # fill in DATABASE_URL + TOKEN_ENCRYPTION_KEY
npm run dev                 # http://localhost:3000
```

Useful scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next config) |
| `npm run build` | Production build |
| `npm run prisma:migrate` | Create/apply a dev migration against `DATABASE_URL` |

Once a DB is connected, exercise the manual-publish flow end to end:

```bash
# 1. create a client workspace
curl -H 'x-agency-id: <id>' -H 'content-type: application/json' \
  -d '{"name":"Acme"}' localhost:3000/api/clients

# 2. connect a Meta account (tokens are encrypted at rest)
curl -H 'x-agency-id: <id>' -H 'content-type: application/json' \
  -d '{"clientId":"<cid>","platform":"facebook","externalAccountId":"<pageId>","accessToken":"<pageToken>"}' \
  localhost:3000/api/social-accounts

# 3. draft a post, then publish it to its target platforms
curl -H 'x-agency-id: <id>' -H 'content-type: application/json' \
  -d '{"clientId":"<cid>","createdBy":"<uid>","content":"hi","platformTargets":["facebook"]}' \
  localhost:3000/api/posts
curl -X POST -H 'x-agency-id: <id>' localhost:3000/api/posts/<postId>/publish
```

Move a post through the approval workflow and schedule it:

```bash
# submit -> approve -> schedule for a future time
curl -X POST -H 'x-agency-id: <id>' -H 'content-type: application/json' \
  -d '{"action":"submit"}'  localhost:3000/api/posts/<postId>/transition
curl -X POST -H 'x-agency-id: <id>' -H 'content-type: application/json' \
  -d '{"action":"approve"}' localhost:3000/api/posts/<postId>/transition
curl -X POST -H 'x-agency-id: <id>' -H 'content-type: application/json' \
  -d '{"action":"schedule","scheduledFor":"2026-12-01T09:00:00Z"}' \
  localhost:3000/api/posts/<postId>/transition
```

Scheduled posts are published by a cron tick (`vercel.json` → `*/5 * * * *`)
that hits `GET /api/cron/publish-due` with `Authorization: Bearer $CRON_SECRET`.

The unified inbox ingests comments two ways: Meta posts to
`/api/webhooks/meta` (verified with `META_APP_SECRET`; subscription handshake
uses `META_WEBHOOK_VERIFY_TOKEN`), and a `*/15` cron polls
`/api/cron/sync-comments` as a fallback. Reply, assign, and manage canned
responses via `/api/comments/[id]/reply`, `/api/comments/[id]/assign`, and
`/api/canned-responses`.

Run the tests with `npm test` (Vitest — crypto, publish orchestration, Meta
adapter, tenant resolver, approval workflow, and the due-post runner; all with
fakes/mocked `fetch`, no network or DB needed).

> **Auth is gated on configuration.** Set `CLERK_SECRET_KEY` +
> `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and requests authenticate via Clerk — the
> tenant is the Clerk Organization mapped to an `Agency` (`Agency.clerkOrgId`).
> With those unset, the app falls back to trusting an `x-agency-id` header for
> local dev / CI. See `src/lib/auth.ts` and `src/middleware.ts`.

## Layout

```
prisma/schema.prisma        # all core tables (docs/data-model.md)
src/lib/db.ts               # Prisma client singleton
src/lib/crypto.ts           # AES-256-GCM token encryption at rest
src/lib/env.ts              # zod-validated environment
src/lib/tenancy.ts          # multi-tenant scoping helpers
src/lib/auth.ts             # tenant resolution (Clerk org -> agency, header fallback)
src/middleware.ts           # gated Clerk middleware (pass-through when unconfigured)
src/lib/adapters/           # PlatformAdapter interface + live Meta adapter + registry
src/lib/publish.ts          # manual-publish orchestrator (injectable, unit-tested)
src/lib/publish-store.ts    # Prisma stores for the orchestrator (tenant + system)
src/lib/workflow.ts         # approval/scheduling state machine (pure, unit-tested)
src/lib/schedule-runner.ts  # due-post publisher run by the cron tick
src/lib/inbox.ts            # comment ingestion (polling + webhook), injectable
src/lib/meta-webhook.ts     # webhook signature verify + event parsing (pure)
vercel.json                 # Vercel Cron schedule for /api/cron/publish-due
src/app/                    # Next.js app router (pages + API routes)
test/                       # Vitest suite
```

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

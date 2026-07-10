# SocialOps

> Multi-tenant social media management SaaS — one dashboard for an agency (or in-house team) to manage many client companies' social accounts: scheduling/publishing posts, replying to comments and DMs across platforms, and reporting performance, with per-client permissions and white-label branding.

Think Hootsuite / Sprout Social, but purpose-built: Node.js, AI-assisted triage, and clean rules-based automation.

---

## Status

**Phases 1–5 — the MVP.** A running Next.js app with the full Prisma data model,
**`PlatformAdapter` implementations for Meta (FB/IG), X, and LinkedIn**, at-rest
token encryption, tenant-scoping helpers, end-to-end **manual publish**, **Clerk
auth** (gated — header fallback in dev), an **approval workflow** (draft →
pending → approved → scheduled), **scheduled publishing** via a cron-driven
due-post scanner, a **content calendar**, a **unified inbox** (Meta **webhook**
ingestion with a **polling cron** fallback, reply/assign/canned responses),
**AI features** (Claude Haiku drafts + sentiment — AI drafts, a human sends),
and **billing & white-label** (gated on `STRIPE_SECRET_KEY`): **Stripe
subscription tiers** with checkout/portal and a status-sync webhook,
**per-account plan limits**, **client branding config**, and **white-labeled
performance reports** with an optional Claude Sonnet summary. Analytics rollups
and polish (Phase 6) remain — see the [roadmap](docs/roadmap.md).

## Getting started

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # fill in DATABASE_URL + TOKEN_ENCRYPTION_KEY
npm run prisma:migrate      # create the schema in your database
npm run dev                 # http://localhost:3000
```

### Connecting a database (required)

Every feature reads/writes Postgres, so the app needs a database before
anything works — creating an agency, adding clients, etc. Without one you'll see
a clear "Database not reachable" message.

1. **Provision Postgres** (Neon is the MVP target). The quickest path on Vercel
   is the **Neon integration** (Vercel → Storage → add Neon), which sets
   `DATABASE_URL` automatically. Otherwise copy your Neon connection string.
2. **Set env vars** (locally in `.env`, and in Vercel → Settings → Environment
   Variables):
   - `DATABASE_URL` — your Postgres/Neon connection string
   - `TOKEN_ENCRYPTION_KEY` — generate with
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
3. **Apply the schema** to that database:
   ```bash
   DATABASE_URL="postgres://…" npm run db:deploy   # runs prisma migrate deploy
   ```
   (Migrations live in `prisma/migrations/`.)
4. **Redeploy** on Vercel so the new env vars take effect.

### Managing customers & accounts (the dashboard)

Open **`/dashboard`** — the agency console:

1. **Create your agency** (the top-level tenant — you / your team). In dev this
   also creates a first admin user and remembers the agency id in the browser.
   With Clerk enabled, the agency comes from your Clerk Organization instead.
2. **Add clients** (your customers / workspaces) in the left panel.
3. **Select a client → Connect account.** Pick a platform, paste the platform
   account id (e.g. a Facebook Page ID, X user ID, or LinkedIn author URN) and an
   access token. The token is **encrypted at rest**. A one-click OAuth flow is a
   planned enhancement — for now you paste an id + token.
4. From a selected client, jump to the composer, calendar, inbox, or generate a
   white-labeled report. The plan's `accounts_limit` caps how many accounts you
   can connect (upgrade in **Billing**).

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

Scheduled posts are published by a cron tick (`vercel.json`) that hits
`GET /api/cron/publish-due` with `Authorization: Bearer $CRON_SECRET`. The
schedules are **daily** because the free Vercel Hobby plan only allows daily
cron jobs; on Pro (or the production worker tier) tighten them to `*/5 * * * *`
for near-real-time publishing.

The unified inbox ingests comments two ways: Meta posts to
`/api/webhooks/meta` (verified with `META_APP_SECRET`; subscription handshake
uses `META_WEBHOOK_VERIFY_TOKEN`), and a daily cron polls
`/api/cron/sync-comments` as a fallback (Hobby-plan cron limit; tighten on Pro). Reply, assign, and manage canned
responses via `/api/comments/[id]/reply`, `/api/comments/[id]/assign`, and
`/api/canned-responses`.

With `ANTHROPIC_API_KEY` set, the inbox can draft replies and tag sentiment
with Claude Haiku — `POST /api/comments/[id]/ai-draft` returns a suggested
reply (a human still sends it) and `POST /api/comments/[id]/classify` stores
`positive`/`neutral`/`negative`. Without the key these return 503.

Billing (gated on `STRIPE_SECRET_KEY` + tier price ids): `POST
/api/billing/checkout` starts a subscription, `POST /api/billing/portal` opens
the Stripe billing portal, and `POST /api/webhooks/stripe` syncs subscription
status into the `subscriptions` table. Connecting accounts is capped at the
plan's `accounts_limit` (402 when exceeded). White-label: `PUT
/api/clients/[id]/branding` sets logo/colors, and `GET /api/clients/[id]/report`
returns a branded, print-ready HTML report (add `?summary=1` for a Claude
Sonnet narrative) — render it to PDF with headless Chromium in production.

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
src/lib/ai.ts               # AI reply drafts + sentiment (injectable LLM, pure prompts)
src/lib/anthropic.ts        # Claude LLM (Haiku drafts / Sonnet reports), gated
src/lib/billing.ts          # plan tiers, Stripe status mapping, limits (pure)
src/lib/stripe.ts           # Stripe client (gated on STRIPE_SECRET_KEY)
src/lib/report.ts           # report aggregation + white-labeled HTML (pure)
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

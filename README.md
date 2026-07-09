# SocialOps

> Multi-tenant social media management SaaS — one dashboard for an agency (or in-house team) to manage many client companies' social accounts: scheduling/publishing posts, replying to comments and DMs across platforms, and reporting performance, with per-client permissions and white-label branding.

Think Hootsuite / Sprout Social, but purpose-built: Node.js, AI-assisted triage, and clean rules-based automation.

---

## Status

**Phase 1 — Foundation + manual publish.** A running Next.js app with the full
Prisma data model, the `PlatformAdapter` interface with a **live Meta (FB/IG)
adapter**, at-rest token encryption, tenant-scoping helpers, and an end-to-end
**manual publish** flow (connect account → draft post → publish to target
platforms). Auth (Clerk) and scheduling (BullMQ) are the next phases — see the
[roadmap](docs/roadmap.md).

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

Run the tests with `npm test` (Vitest — crypto, publish orchestration, and the
Meta adapter, all with fakes/mocked `fetch`, no network or DB needed).

> Tenant resolution currently reads an `x-agency-id` header as a placeholder for
> the Clerk session that lands in a later phase (see `src/lib/api.ts`).

## Layout

```
prisma/schema.prisma        # all core tables (docs/data-model.md)
src/lib/db.ts               # Prisma client singleton
src/lib/crypto.ts           # AES-256-GCM token encryption at rest
src/lib/env.ts              # zod-validated environment
src/lib/tenancy.ts          # multi-tenant scoping helpers
src/lib/adapters/           # PlatformAdapter interface + live Meta adapter + registry
src/lib/publish.ts          # manual-publish orchestrator (injectable, unit-tested)
src/lib/publish-store.ts    # Prisma-backed, tenant-scoped store for the orchestrator
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

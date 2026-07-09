# Tech Stack

The MVP stack and the production stack **share the same data model and adapter
interfaces**. Migrating from one to the other is a hosting/infra change, not a
rewrite.

---

## Phase 0 / MVP Stack (free-tier, current build target)

| Layer | Choice | Why |
|---|---|---|
| Frontend + API routes | **Vercel** (Next.js) | Zero-config deploys, preview URLs per PR for client approval flows |
| Source / CI | **GitHub + GitHub Actions** | Free Actions minutes cover lint/typecheck/test easily |
| Database | **Neon** (serverless Postgres) | DB branching per feature/test is genuinely useful |
| ORM | **Prisma** | Type-safe, clean migrations, pairs well with Neon |
| Auth | **Clerk** (free tier) | Native "Organizations" concept maps ~1:1 onto agency → client → user hierarchy |
| Scheduled jobs | **Vercel Cron Jobs** | No always-on worker needed for MVP |
| Queue (post-MVP) | **Upstash QStash** or Upstash Redis + BullMQ | Serverless / pay-per-request, no persistent server to keep warm |
| File / media storage | **Vercel Blob** | Same vendor as hosting, avoids adding another account for MVP |
| AI features | **Claude API** (Haiku for drafts/sentiment, Sonnet for reports) | Pay-as-you-go, cheap at test volume |
| Social APIs | Meta Graph API (FB/IG) first, then LinkedIn, X, TikTok | Isolate each behind a `PlatformAdapter` interface (see [Architecture](architecture.md)) |
| Billing | **Stripe** (test mode) | Free until going live |

## Production / Scale Stack (migrate to later)

| Layer | Choice | Why |
|---|---|---|
| Backend workers | Dedicated NestJS service on Railway/Fly.io or self-managed infra | Needed once Cron/QStash volume outgrows serverless limits |
| Queue | BullMQ + managed Redis | More control over retries, concurrency, rate-limit windows |
| Media storage | S3 or Backblaze B2 | Cheaper at scale than Vercel Blob |
| Database | Neon paid tier or self-managed Postgres | More compute / connections |

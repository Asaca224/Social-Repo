# Data Model (Core Tables)

The same schema backs both the MVP and the production stack. Tokens are stored
encrypted at rest (see [Architecture → Encrypt tokens](architecture.md)).

```
agencies
  id, name, plan_tier, stripe_customer_id, created_at

users
  id, agency_id, email, role (admin/manager/client_viewer/client_approver), created_at

clients (workspaces)
  id, agency_id, name, branding_config (logo/colors), created_at

client_users  -- client-side portal access
  id, client_id, user_id, permission_level

social_accounts
  id, client_id, platform (enum), external_account_id,
  access_token (encrypted), refresh_token (encrypted), token_expires_at, status

posts
  id, client_id, created_by, content, media_urls[], platform_targets[],
  status (draft/pending_approval/approved/scheduled/published/failed),
  scheduled_for, published_at, platform_post_ids (jsonb)

comments
  id, social_account_id, platform_comment_id, author_name, body,
  sentiment (enum), assigned_to, status (open/replied/ignored), received_at

replies
  id, comment_id, body, sent_by, ai_generated (bool), sent_at

analytics_snapshots
  id, social_account_id, date, followers, impressions, engagement_rate, raw_json

subscriptions
  id, agency_id, stripe_subscription_id, tier, seats, accounts_limit, status
```

## Relationships at a glance

- An **agency** has many **users**, **clients**, and one **subscription**.
- A **client** (workspace) belongs to one agency and has many **social_accounts**, **posts**, and **client_users**.
- A **social_account** belongs to one client and has many **comments** and **analytics_snapshots**.
- A **comment** belongs to one social_account and has many **replies**.
- **client_users** is the join between a client workspace and a portal user, carrying a `permission_level` for view-only / approve-only access.

## Enums (indicative)

| Field | Values |
|---|---|
| `users.role` | `admin`, `manager`, `client_viewer`, `client_approver` |
| `social_accounts.platform` | `instagram`, `facebook`, `x`, `linkedin`, `tiktok`, `google_business` |
| `social_accounts.status` | `connected`, `needs_reauth`, `disconnected` |
| `posts.status` | `draft`, `pending_approval`, `approved`, `scheduled`, `published`, `failed` |
| `comments.sentiment` | `positive`, `neutral`, `negative` |
| `comments.status` | `open`, `replied`, `ignored` |

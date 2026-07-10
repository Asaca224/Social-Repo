import type { SubscriptionStatus } from "@prisma/client";

/**
 * Billing logic (Phase 5). Pure and dependency-free so tier math, Stripe status
 * mapping, and limit checks are unit-tested without Stripe or a DB. The Stripe
 * client itself lives in src/lib/stripe.ts (gated on STRIPE_SECRET_KEY).
 *
 * V1 is simple agency→you billing (no Stripe Connect / reseller mode).
 */

export interface PlanTier {
  id: string;
  name: string;
  seats: number;
  accountsLimit: number;
  /** Env var holding the Stripe Price id for this tier. */
  priceEnvVar: string;
}

export const PLAN_TIERS: Record<string, PlanTier> = {
  starter: {
    id: "starter",
    name: "Starter",
    seats: 2,
    accountsLimit: 5,
    priceEnvVar: "STRIPE_PRICE_STARTER",
  },
  growth: {
    id: "growth",
    name: "Growth",
    seats: 5,
    accountsLimit: 20,
    priceEnvVar: "STRIPE_PRICE_GROWTH",
  },
  agency: {
    id: "agency",
    name: "Agency",
    seats: 20,
    accountsLimit: 100,
    priceEnvVar: "STRIPE_PRICE_AGENCY",
  },
};

/** Accounts allowed before any paid subscription exists (free tier). */
export const FREE_ACCOUNTS_LIMIT = 1;

export function getTier(tierId: string): PlanTier | null {
  return PLAN_TIERS[tierId] ?? null;
}

/**
 * Map a Stripe subscription status to our enum. Unknown/blocking states
 * collapse to the nearest of active/trialing/past_due/canceled.
 */
export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      return "canceled";
  }
}

/** A subscription grants access only while active or trialing. */
export function isEntitled(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Whether another social account may be connected. `limit` is the agency's
 * `accounts_limit` (or {@link FREE_ACCOUNTS_LIMIT} when there is no active sub).
 */
export function canConnectAccount(
  currentCount: number,
  limit: number,
): boolean {
  return currentCount < limit;
}

/** Resolve the effective account limit from a subscription (or free tier). */
export function effectiveAccountLimit(
  sub: { status: SubscriptionStatus; accountsLimit: number } | null,
): number {
  if (sub && isEntitled(sub.status)) return sub.accountsLimit;
  return FREE_ACCOUNTS_LIMIT;
}

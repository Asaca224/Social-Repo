import Stripe from "stripe";

/**
 * Stripe client, gated on STRIPE_SECRET_KEY. {@link getStripe} returns null when
 * unset so billing routes respond 503 and the app runs without Stripe.
 */

let cached: Stripe | null = null;

export function isBillingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!cached) {
    // Use the SDK's pinned API version (no explicit apiVersion needed).
    cached = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return cached;
}

/** Base URL for post-checkout redirects. */
export function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

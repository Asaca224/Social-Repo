import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getTier, mapStripeStatus, PLAN_TIERS } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook: keeps the local `subscriptions` table in sync with Stripe.
 * Verifies the signature with STRIPE_WEBHOOK_SECRET, then upserts subscription
 * state (status, tier, seats, accounts_limit) and records the agency's
 * Stripe customer id.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return new Response("Billing not configured", { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    return new Response(
      `Invalid signature: ${err instanceof Error ? err.message : "unknown"}`,
      { status: 401 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const agencyId = session.client_reference_id ?? session.metadata?.agencyId;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (agencyId && customerId) {
        await prisma.agency.update({
          where: { id: agencyId },
          data: { stripeCustomerId: customerId },
        });
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const agencyId = sub.metadata?.agencyId;
      const tierId = sub.metadata?.tier;
      if (agencyId) {
        const tier =
          (tierId ? getTier(tierId) : null) ?? PLAN_TIERS.starter!;
        const status = mapStripeStatus(sub.status);
        await prisma.subscription.upsert({
          where: { agencyId },
          create: {
            agencyId,
            stripeSubscriptionId: sub.id,
            tier: tier.id,
            seats: tier.seats,
            accountsLimit: tier.accountsLimit,
            status,
          },
          update: {
            stripeSubscriptionId: sub.id,
            tier: tier.id,
            seats: tier.seats,
            accountsLimit: tier.accountsLimit,
            status,
          },
        });
      }
      break;
    }
    default:
      // Unhandled event types are acknowledged so Stripe doesn't retry.
      break;
  }

  return Response.json({ received: true });
}

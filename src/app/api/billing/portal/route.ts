import { prisma } from "@/lib/db";
import { errorResponse, json } from "@/lib/api";
import { resolveTenant } from "@/lib/auth";
import { getStripe, appUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Create a Stripe billing-portal session so the agency can manage its
 * subscription, payment method, and invoices. Returns the portal URL.
 */
export async function POST(request: Request) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const stripe = getStripe();
  if (!stripe) return errorResponse("Billing is not configured (STRIPE_SECRET_KEY)", 503);

  const agency = await prisma.agency.findUnique({
    where: { id: ctx.agencyId },
    select: { stripeCustomerId: true },
  });
  if (!agency?.stripeCustomerId) {
    return errorResponse("No Stripe customer for this agency yet", 409);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: agency.stripeCustomerId,
    return_url: `${appUrl()}/billing`,
  });

  return json({ url: session.url });
}

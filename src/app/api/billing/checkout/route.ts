import { z } from "zod";
import { prisma } from "@/lib/db";
import { errorResponse, json, zodErrorResponse } from "@/lib/api";
import { resolveTenant } from "@/lib/auth";
import { getStripe, appUrl } from "@/lib/stripe";
import { getTier } from "@/lib/billing";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tier: z.enum(["starter", "growth", "agency"]),
});

/**
 * Create a Stripe Checkout session for a subscription tier. Returns the hosted
 * checkout URL for the caller to redirect to.
 */
export async function POST(request: Request) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const stripe = getStripe();
  if (!stripe) return errorResponse("Billing is not configured (STRIPE_SECRET_KEY)", 503);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const tier = getTier(parsed.data.tier);
  if (!tier) return errorResponse("Unknown tier", 400);

  const priceId = process.env[tier.priceEnvVar];
  if (!priceId) return errorResponse(`Price not configured (${tier.priceEnvVar})`, 503);

  const agency = await prisma.agency.findUnique({
    where: { id: ctx.agencyId },
    select: { id: true, stripeCustomerId: true },
  });
  if (!agency) return errorResponse("Agency not found", 404);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: agency.stripeCustomerId ?? undefined,
    client_reference_id: agency.id,
    // Carry the tier so the webhook can size the subscription's limits.
    subscription_data: { metadata: { agencyId: agency.id, tier: tier.id } },
    metadata: { agencyId: agency.id, tier: tier.id },
    success_url: `${appUrl()}/billing?status=success`,
    cancel_url: `${appUrl()}/billing?status=cancelled`,
  });

  return json({ url: session.url });
}

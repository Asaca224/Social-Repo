import { prisma } from "./db";
import type { TenantContext } from "./tenancy";

/**
 * Tenant resolution.
 *
 * When Clerk is configured (both keys present), the tenant is the Clerk
 * Organization mapped to an Agency via `Agency.clerkOrgId`. When it is not
 * configured, we fall back to an `x-agency-id` header so the app stays usable in
 * local dev and CI without Clerk keys.
 *
 * The Clerk-specific call is isolated in {@link clerkOrgId}, and the decision
 * logic is a pure function ({@link resolveTenantWith}) so it can be unit-tested
 * without Clerk or a database.
 */

export function isClerkEnabled(): boolean {
  return Boolean(
    process.env.CLERK_SECRET_KEY &&
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
}

/** The one place that touches Clerk. Returns the active org id, or null. */
async function clerkOrgId(): Promise<string | null> {
  // Dynamic import so Clerk is only loaded when actually enabled.
  const { auth } = await import("@clerk/nextjs/server");
  const { orgId } = auth();
  return orgId ?? null;
}

export interface TenantResolverDeps {
  clerkEnabled: boolean;
  getOrgId: () => Promise<string | null>;
  findAgencyIdByOrg: (orgId: string) => Promise<string | null>;
  headerAgencyId: string | null;
}

/** Pure resolution logic — see {@link resolveTenant} for the wired version. */
export async function resolveTenantWith(
  deps: TenantResolverDeps,
): Promise<TenantContext | null> {
  if (deps.clerkEnabled) {
    const orgId = await deps.getOrgId();
    if (!orgId) return null;
    const agencyId = await deps.findAgencyIdByOrg(orgId);
    return agencyId ? { agencyId } : null;
  }
  return deps.headerAgencyId ? { agencyId: deps.headerAgencyId } : null;
}

/** Resolve the tenant for an incoming request. */
export async function resolveTenant(
  request: Request,
): Promise<TenantContext | null> {
  return resolveTenantWith({
    clerkEnabled: isClerkEnabled(),
    getOrgId: clerkOrgId,
    findAgencyIdByOrg: async (orgId) => {
      const agency = await prisma.agency.findUnique({
        where: { clerkOrgId: orgId },
        select: { id: true },
      });
      return agency?.id ?? null;
    },
    headerAgencyId: request.headers.get("x-agency-id"),
  });
}

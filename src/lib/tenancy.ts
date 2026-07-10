import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Multi-tenant scoping helpers.
 *
 * Every tenant-owned query MUST be constrained to a single agency. These
 * helpers centralise that so route handlers can't accidentally read across
 * tenants. Auth (Clerk) lands in a later phase; for now the caller passes the
 * resolved `agencyId` explicitly.
 */

export interface TenantContext {
  agencyId: string;
}

/** Where-clause fragment scoping a Client query to the tenant's agency. */
export function clientScope(ctx: TenantContext): Prisma.ClientWhereInput {
  return { agencyId: ctx.agencyId };
}

/**
 * Load a Client by id, but only if it belongs to the tenant's agency.
 * Returns null when the client does not exist OR belongs to another agency —
 * callers should treat both as "not found" and never leak the difference.
 */
export async function getClientForTenant(
  ctx: TenantContext,
  clientId: string,
) {
  return prisma.client.findFirst({
    where: { id: clientId, agencyId: ctx.agencyId },
  });
}

/**
 * Assert a client belongs to the tenant, throwing {@link TenantAccessError}
 * otherwise. Use before any write scoped to a client.
 */
export async function assertClientInTenant(
  ctx: TenantContext,
  clientId: string,
): Promise<void> {
  const client = await getClientForTenant(ctx, clientId);
  if (!client) {
    throw new TenantAccessError(clientId);
  }
}

export class TenantAccessError extends Error {
  constructor(public readonly clientId: string) {
    super(`Client ${clientId} not found in this agency`);
    this.name = "TenantAccessError";
  }
}

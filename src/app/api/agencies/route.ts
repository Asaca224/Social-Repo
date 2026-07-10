import { z } from "zod";
import { prisma } from "@/lib/db";
import { errorResponse, json, zodErrorResponse } from "@/lib/api";
import { isClerkEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  adminEmail: z.string().email(),
});

/**
 * Bootstrap an agency (tenant) plus its first admin user, and return their ids.
 *
 * This is the dev/self-serve entry point used before Clerk is wired: with Clerk
 * enabled, agencies are provisioned from the Clerk Organization (via a webhook),
 * so this endpoint is disabled to avoid an unauthenticated tenant-creation path.
 */
export async function POST(request: Request) {
  if (isClerkEnabled()) {
    return errorResponse(
      "Agency provisioning is managed by Clerk when auth is enabled.",
      403,
    );
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const agency = await prisma.agency.create({
    data: {
      name: parsed.data.name,
      users: { create: { email: parsed.data.adminEmail, role: "admin" } },
    },
    select: { id: true, name: true, users: { select: { id: true, email: true } } },
  });

  return json(
    { agencyId: agency.id, name: agency.name, adminUserId: agency.users[0]?.id },
    { status: 201 },
  );
}

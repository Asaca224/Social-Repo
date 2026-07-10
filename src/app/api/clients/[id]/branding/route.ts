import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getClientForTenant } from "@/lib/tenancy";
import { errorResponse, json, zodErrorResponse } from "@/lib/api";
import { resolveTenant } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Read a client's white-label branding config. */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const client = await getClientForTenant(ctx, params.id);
  if (!client) return errorResponse("Client not found", 404);

  return json({ branding: client.brandingConfig ?? null });
}

const brandingSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  companyName: z.string().max(200).optional(),
  voice: z.string().max(500).optional(),
});

/** Update a client's white-label branding config. */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const client = await getClientForTenant(ctx, params.id);
  if (!client) return errorResponse("Client not found", 404);

  const parsed = brandingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const updated = await prisma.client.update({
    where: { id: params.id },
    data: { brandingConfig: parsed.data as Prisma.InputJsonValue },
    select: { id: true, brandingConfig: true },
  });
  return json({ client: updated });
}

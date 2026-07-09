import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { clientScope } from "@/lib/tenancy";
import { errorResponse, json, resolveTenant, zodErrorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** List clients (workspaces) for the current agency. */
export async function GET(request: Request) {
  const ctx = resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const clients = await prisma.client.findMany({
    where: clientScope(ctx),
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true },
  });
  return json({ clients });
}

const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  brandingConfig: z.record(z.unknown()).optional(),
});

/** Create a client workspace under the current agency. */
export async function POST(request: Request) {
  const ctx = resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const body = await request.json().catch(() => null);
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const client = await prisma.client.create({
    data: {
      agencyId: ctx.agencyId,
      name: parsed.data.name,
      brandingConfig:
        (parsed.data.brandingConfig as Prisma.InputJsonValue | undefined) ??
        undefined,
    },
    select: { id: true, name: true, createdAt: true },
  });
  return json({ client }, { status: 201 });
}

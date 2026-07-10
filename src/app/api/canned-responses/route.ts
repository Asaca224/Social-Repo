import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertClientInTenant, TenantAccessError } from "@/lib/tenancy";
import { errorResponse, json, zodErrorResponse } from "@/lib/api";
import { resolveTenant } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** List a client's saved replies. */
export async function GET(request: Request) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return errorResponse("clientId query param required", 400);

  try {
    await assertClientInTenant(ctx, clientId);
  } catch (err) {
    if (err instanceof TenantAccessError) return errorResponse("Client not found", 404);
    throw err;
  }

  const cannedResponses = await prisma.cannedResponse.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true, createdAt: true },
  });
  return json({ cannedResponses });
}

const createSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
});

/** Create a saved reply for a client. */
export async function POST(request: Request) {
  const ctx = await resolveTenant(request);
  if (!ctx) return errorResponse("Missing agency context", 401);

  const raw = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    await assertClientInTenant(ctx, parsed.data.clientId);
  } catch (err) {
    if (err instanceof TenantAccessError) return errorResponse("Client not found", 404);
    throw err;
  }

  const cannedResponse = await prisma.cannedResponse.create({
    data: {
      clientId: parsed.data.clientId,
      title: parsed.data.title,
      body: parsed.data.body,
    },
    select: { id: true, title: true, body: true, createdAt: true },
  });
  return json({ cannedResponse }, { status: 201 });
}

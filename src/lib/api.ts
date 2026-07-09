import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type { TenantContext } from "./tenancy";

/**
 * Shared helpers for route handlers.
 *
 * Tenant resolution is a PLACEHOLDER: until Clerk auth lands (see roadmap),
 * the agency is read from an `x-agency-id` request header. This keeps the API
 * exercisable end-to-end without wiring auth, and gives one obvious spot to
 * replace with the real session lookup later.
 */

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function zodErrorResponse(error: ZodError): NextResponse {
  return NextResponse.json(
    {
      error: "Validation failed",
      issues: error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    },
    { status: 422 },
  );
}

/**
 * Resolve the tenant for a request. Returns null when no agency is present, so
 * callers can respond 401. Replace the header lookup with a Clerk session in a
 * later phase.
 */
export function resolveTenant(request: Request): TenantContext | null {
  const agencyId = request.headers.get("x-agency-id");
  if (!agencyId) return null;
  return { agencyId };
}

import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/**
 * Shared response helpers for route handlers. Tenant resolution lives in
 * src/lib/auth.ts (kept out of here so this module stays free of DB imports).
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

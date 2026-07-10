import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk middleware, gated on configuration. When Clerk keys are absent (local
 * dev / CI), this is a pass-through so the app runs without Clerk. When present,
 * `clerkMiddleware()` populates the auth context that src/lib/auth.ts reads.
 */
const clerkEnabled = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

export default clerkEnabled
  ? clerkMiddleware()
  : function middleware() {
      return NextResponse.next();
    };

export const config = {
  // Run on everything except static assets; always run on API routes.
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)"],
};

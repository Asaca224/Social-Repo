import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { AppProvider } from "@/components/app-context";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "SocialOps",
  description: "Multi-tenant social media management",
};

// Only wrap in ClerkProvider when Clerk is configured; otherwise the app runs
// unauthenticated (dev/CI) with the x-agency-id header fallback.
const clerkEnabled = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

export default function RootLayout({ children }: { children: ReactNode }) {
  const page = (
    <html lang="en">
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{page}</ClerkProvider> : page;
}

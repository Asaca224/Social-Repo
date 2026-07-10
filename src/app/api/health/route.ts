import { json } from "@/lib/api";
import { supportedPlatforms } from "@/lib/adapters";

export const dynamic = "force-dynamic";

/** Liveness + capability probe. No auth, no DB. */
export async function GET() {
  return json({
    status: "ok",
    service: "socialops",
    phase: "1-foundation",
    supportedPlatforms: supportedPlatforms(),
    timestamp: new Date().toISOString(),
  });
}

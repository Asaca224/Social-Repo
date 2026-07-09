import { z } from "zod";

/**
 * Validated environment. Import `env` anywhere server-side instead of reading
 * `process.env` directly, so a missing/malformed variable fails fast and loud.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgres")),
  // 32-byte key, base64-encoded. Validated at use in src/lib/crypto.ts.
  TOKEN_ENCRYPTION_KEY: z.string().min(1).optional(),

  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_GRAPH_API_VERSION: z.string().default("v21.0"),
  // Token echoed back during Meta webhook subscription verification.
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // Auth (Clerk). Optional: when unset, the app falls back to the
  // x-agency-id header (see src/lib/auth.ts).
  CLERK_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),

  // Shared secret guarding the scheduled-publish cron (see vercel.json).
  CRON_SECRET: z.string().optional(),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Parse and cache environment variables. Call from server code only.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

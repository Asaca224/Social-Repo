/**
 * Normalize database env vars.
 *
 * The app reads `DATABASE_URL`, but the Vercel–Neon / Vercel Postgres
 * integrations provision differently-named variables (e.g. POSTGRES_PRISMA_URL).
 * If DATABASE_URL isn't set but one of those is, map it over so the app works
 * whether the user set DATABASE_URL directly or connected the integration.
 *
 * Imported for its side effect at the top of db.ts and env.ts so it runs before
 * the Prisma client or env validation reads process.env.
 */
const FALLBACK_KEYS = [
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

if (!process.env.DATABASE_URL) {
  for (const key of FALLBACK_KEYS) {
    const value = process.env[key];
    if (value) {
      process.env.DATABASE_URL = value;
      break;
    }
  }
}

export {};

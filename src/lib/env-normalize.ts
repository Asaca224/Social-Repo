/**
 * Normalize the database URL env var.
 *
 * The app reads `DATABASE_URL`, but two things commonly go wrong when it's set
 * by hand in a hosting dashboard:
 *   1. The value gets wrapped in quotes, has stray whitespace/newlines, or is
 *      pasted as Neon's `psql '…'` snippet — so it doesn't start with the
 *      required `postgresql://` protocol and Prisma rejects it.
 *   2. The Vercel–Neon / Vercel Postgres integration provisions differently
 *      named variables (POSTGRES_PRISMA_URL, POSTGRES_URL, …) instead.
 *
 * This runs for its side effect at the top of db.ts and env.ts so it executes
 * before the Prisma client or env validation reads process.env.
 */
const FALLBACK_KEYS = [
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

function sanitize(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let v = raw.trim();
  // Neon's dashboard "psql" snippet is `psql 'postgresql://…'`.
  if (v.toLowerCase().startsWith("psql ")) v = v.slice(5).trim();
  // Strip a `DATABASE_URL=` prefix if the whole assignment was pasted.
  v = v.replace(/^DATABASE_URL\s*=\s*/i, "");
  // Strip one layer of surrounding single or double quotes.
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

let candidate = process.env.DATABASE_URL;
if (!candidate) {
  for (const key of FALLBACK_KEYS) {
    if (process.env[key]) {
      candidate = process.env[key];
      break;
    }
  }
}

const cleaned = sanitize(candidate);
if (cleaned) process.env.DATABASE_URL = cleaned;

export {};

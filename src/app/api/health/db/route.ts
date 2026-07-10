import { prisma, isDatabaseUnavailable } from "@/lib/db";
import { json, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Database connectivity probe. Reports whether this deployment can reach the
 * database and whether env vars are present — useful for diagnosing a
 * "Database not reachable" error per deployment/environment.
 */
export async function GET() {
  const hasUrl = Boolean(process.env.DATABASE_URL);
  const hasEncryptionKey = Boolean(process.env.TOKEN_ENCRYPTION_KEY);
  // Which DB-related vars are actually present (names only, never values).
  const present = Object.fromEntries(
    [
      "DATABASE_URL",
      "POSTGRES_PRISMA_URL",
      "POSTGRES_URL",
      "POSTGRES_URL_NON_POOLING",
      "DATABASE_URL_UNPOOLED",
    ].map((k) => [k, Boolean(process.env[k])]),
  );

  if (!hasUrl) {
    return json(
      {
        db: "misconfigured",
        DATABASE_URL: false,
        TOKEN_ENCRYPTION_KEY: hasEncryptionKey,
        presentEnvVars: present,
        hint: "No database URL found. Add a DATABASE_URL var in Vercel for this environment (Production AND Preview) and redeploy. If you connected the Neon/Vercel Postgres integration, the app now also accepts POSTGRES_PRISMA_URL / POSTGRES_URL automatically — redeploy to pick it up.",
      },
      { status: 503 },
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({
      db: "ok",
      DATABASE_URL: true,
      TOKEN_ENCRYPTION_KEY: hasEncryptionKey,
      presentEnvVars: present,
    });
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return json(
        {
          db: "unreachable",
          DATABASE_URL: true,
          TOKEN_ENCRYPTION_KEY: hasEncryptionKey,
          hint: "DATABASE_URL is set but the database can't be reached or has no tables. Check the value and that migrations ran.",
        },
        { status: 503 },
      );
    }
    return errorResponse("Unexpected error", 500);
  }
}

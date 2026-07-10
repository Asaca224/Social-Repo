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
    // Surface the Prisma error code + first line of the message (never the
    // password — Prisma messages don't include it) to pinpoint the cause:
    // P1000 auth failed, P1001 can't reach host, P1003 db doesn't exist, etc.
    const code = (err as { code?: string })?.code ?? null;
    const detail =
      err instanceof Error ? err.message.split("\n").slice(0, 3).join(" ").slice(0, 300) : null;
    if (isDatabaseUnavailable(err)) {
      return json(
        {
          db: "unreachable",
          DATABASE_URL: true,
          TOKEN_ENCRYPTION_KEY: hasEncryptionKey,
          presentEnvVars: present,
          code,
          detail,
          hint: "DATABASE_URL is set but the query failed. P1000=bad credentials, P1001=host unreachable, P1003=database name wrong. Neon tip: drop `channel_binding=require` from the string, keep `sslmode=require`.",
        },
        { status: 503 },
      );
    }
    return json({ db: "error", code, detail }, { status: 500 });
  }
}

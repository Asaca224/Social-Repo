import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton. In development, Next.js hot-reload would otherwise
 * spawn a new client (and connection pool) on every reload, so we stash it on
 * globalThis.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * True when an error means the database can't be used yet — unreachable,
 * bad credentials, or the schema hasn't been migrated (tables missing). Lets
 * routes return a clear "set up your database" message instead of a bare 500.
 */
export function isDatabaseUnavailable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P1xxx: connection/auth. P2021/P2022: table/column doesn't exist (not migrated).
    return err.code.startsWith("P1") || err.code === "P2021" || err.code === "P2022";
  }
  // Fallback by name/message (robust against instanceof across module copies).
  const name = err instanceof Error ? err.name : "";
  if (name === "PrismaClientInitializationError") return true;
  const code = (err as { code?: string })?.code;
  if (typeof code === "string" && (code.startsWith("P1") || code === "P2021" || code === "P2022")) {
    return true;
  }
  const message = err instanceof Error ? err.message : "";
  return /ECONNREFUSED|ENOTFOUND|can't reach database|does not exist|Connection refused/i.test(
    message,
  );
}

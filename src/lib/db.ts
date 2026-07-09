import { PrismaClient } from "@prisma/client";

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

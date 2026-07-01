import { PrismaClient } from "@prisma/client";

const PRISMA_PANIC_WARNING = "Kết nối cơ sở dữ liệu đang gặp sự cố. Vui lòng khởi động lại ứng dụng hoặc thử lại sau.";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function isPrismaPanicError(error: unknown) {
  if (!(error instanceof Error)) return false;

  return error.name === "PrismaClientRustPanicError" || error.message.includes("PANIC: timer has gone away");
}

export function getDatabaseErrorMessage(error: unknown, fallback: string) {
  return isPrismaPanicError(error) ? PRISMA_PANIC_WARNING : fallback;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

export const db = prisma;

// Hostinger runs a persistent Node process; keep the client on globalThis in production too
// so separately loaded server chunks reuse the same Prisma engine instead of spawning extras.
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

import { db } from "../src/lib/db";
import { hashAdminPassword } from "../src/features/auth/admin-auth";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || undefined;
  const reset = process.env.ADMIN_BOOTSTRAP_RESET === "true";
  if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  const existing = await db.adminUser.findUnique({ where: { email } });
  if (existing && !reset) throw new Error("Admin user already exists. Set ADMIN_BOOTSTRAP_RESET=true to reset password explicitly.");
  const passwordHash = hashAdminPassword(password);
  if (existing) {
    await db.adminUser.update({ where: { id: existing.id }, data: { passwordHash, name, status: "active", lastLoginAt: null } });
    await db.adminAuthSession.updateMany({ where: { adminUserId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } });
    console.log(`Admin user ${email} password reset and active sessions revoked.`);
    return;
  }
  await db.adminUser.create({ data: { email, name, passwordHash, role: "owner", status: "active" } });
  console.log(`Admin user ${email} created.`);
}

main().finally(async () => db.$disconnect());

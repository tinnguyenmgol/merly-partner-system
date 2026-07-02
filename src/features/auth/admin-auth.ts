import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

import { ADMIN_COOKIE_NAME } from "@/lib/admin-cookie";
export { ADMIN_COOKIE_NAME };
export const ADMIN_LOGIN_ERROR = "Email hoặc mật khẩu không đúng.";
const SESSION_DAYS = 7;

function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function rawToken() { return randomBytes(32).toString("base64url"); }
export function hashAdminPassword(password: string) { const salt = randomBytes(16).toString("hex"); const hash = scryptSync(password, salt, 64).toString("hex"); return `scrypt:${salt}:${hash}`; }
export function verifyAdminPassword(password: string, stored: string | null) { if (!stored) return false; const [scheme, salt, hash] = stored.split(":"); if (scheme !== "scrypt" || !salt || !hash) return false; const candidate = Buffer.from(scryptSync(password, salt, 64).toString("hex")); const expected = Buffer.from(hash); return candidate.length === expected.length && timingSafeEqual(candidate, expected); }
async function cookieStore() { return cookies(); }
async function requestMeta() { const h = await headers(); return { userAgent: h.get("user-agent") ?? undefined, ipHash: h.get("x-forwarded-for") ? sha256(h.get("x-forwarded-for")!.split(",")[0].trim()) : undefined }; }

export async function createAdminSession(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const admin = await db.adminUser.findUnique({ where: { email: normalizedEmail } });
  if (!admin || admin.status !== "active" || !verifyAdminPassword(password, admin.passwordHash)) return null;
  const token = rawToken();
  const meta = await requestMeta();
  await db.adminAuthSession.create({ data: { adminUserId: admin.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000), ...meta } });
  await db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  (await cookieStore()).set(ADMIN_COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86400 });
  return admin;
}

export async function getCurrentAdminSession() {
  const token = (await cookieStore()).get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return db.adminAuthSession.findFirst({ where: { tokenHash: sha256(token), revokedAt: null, expiresAt: { gt: new Date() }, adminUser: { status: "active" } }, include: { adminUser: true } });
}

export async function requireAdminSession() {
  const session = await getCurrentAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function destroyAdminSession() {
  const store = await cookieStore();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  if (token) await db.adminAuthSession.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  store.delete(ADMIN_COOKIE_NAME);
}

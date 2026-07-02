import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const COOKIE_NAME = "merly_partner_session";
const SESSION_DAYS = 30;
const SETUP_DAYS = 7;
const RESET_MINUTES = 60;

export function normalizeLogin(input: string) {
  const value = input.trim().toLowerCase();
  if (value.includes("@")) return { email: value };
  const compact = value.replace(/[\s.-]+/g, "");
  if (/^\+84[1-9]\d*$/.test(compact)) return { phone: `0${compact.slice(3)}` };
  if (/^84[1-9]\d*$/.test(compact) && compact.length >= 10 && compact.length <= 11) return { phone: `0${compact.slice(2)}` };
  return { phone: compact };
}

function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function rawToken() { return randomBytes(32).toString("base64url"); }
function hashPassword(password: string) { const salt = randomBytes(16).toString("hex"); const hash = scryptSync(password, salt, 64).toString("hex"); return `scrypt:${salt}:${hash}`; }
function verifyPassword(password: string, stored: string | null) { if (!stored) return false; const [scheme, salt, hash] = stored.split(":"); if (scheme !== "scrypt" || !salt || !hash) return false; const candidate = Buffer.from(scryptSync(password, salt, 64).toString("hex")); const expected = Buffer.from(hash); return candidate.length === expected.length && timingSafeEqual(candidate, expected); }
async function cookieStore() { return cookies(); }
async function requestMeta() { const h = await headers(); return { userAgent: h.get("user-agent") ?? undefined, ipHash: h.get("x-forwarded-for") ? sha256(h.get("x-forwarded-for")!.split(",")[0].trim()) : undefined }; }

export async function generateSetupPasswordToken(accountId: string, purpose = "setup_password") {
  const token = rawToken();
  const ttlMs = purpose === "reset_password" ? RESET_MINUTES * 60000 : SETUP_DAYS * 86400000;
  await db.partnerAuthToken.create({ data: { accountId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

export async function createPasswordResetTokenForLogin(login: string) {
  const normalized = normalizeLogin(login);
  const account = await db.partnerAccount.findFirst({ where: { OR: [{ email: normalized.email ?? "__none__" }, { phone: normalized.phone ?? "__none__" }] } });
  if (!account || account.status === "disabled") return null;
  return generateSetupPasswordToken(account.id, "reset_password");
}

export async function validateAuthToken(token: string, purpose: "setup_password" | "reset_password" = "setup_password") {
  if (!token) return null;
  return db.partnerAuthToken.findFirst({ where: { tokenHash: sha256(token), purpose, usedAt: null, expiresAt: { gt: new Date() } }, include: { account: { include: { partner: true } } } });
}

export async function setPasswordWithToken(token: string, password: string, purpose: "setup_password" | "reset_password" = "setup_password") {
  const authToken = await validateAuthToken(token, purpose);
  if (!authToken) return { ok: false, message: purpose === "reset_password" ? "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn." : "Link thiết lập mật khẩu không hợp lệ hoặc đã hết hạn." };
  if (password.length < 8) return { ok: false, message: "Mật khẩu phải có ít nhất 8 ký tự." };
  await db.$transaction([
    db.partnerAccount.update({ where: { id: authToken.accountId }, data: { passwordHash: hashPassword(password), status: "active", passwordSetAt: new Date() } }),
    db.partnerAuthToken.update({ where: { id: authToken.id }, data: { usedAt: new Date() } }),
    ...(purpose === "reset_password" ? [db.partnerAuthSession.updateMany({ where: { accountId: authToken.accountId, revokedAt: null }, data: { revokedAt: new Date() } })] : []),
  ]);
  return { ok: true, message: "Đã thiết lập mật khẩu. Vui lòng đăng nhập." };
}

export async function createPartnerSession(login: string, password: string) {
  // TODO: add per-IP and per-account brute-force rate limiting before production scale.
  const normalized = normalizeLogin(login);
  const account = await db.partnerAccount.findFirst({ where: { status: "active", OR: [{ email: normalized.email ?? "__none__" }, { phone: normalized.phone ?? "__none__" }] }, include: { partner: true } });
  if (!account || !verifyPassword(password, account.passwordHash)) return null;
  const token = rawToken(); const meta = await requestMeta();
  await db.partnerAuthSession.create({ data: { accountId: account.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000), ...meta } });
  await db.partnerAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
  (await cookieStore()).set(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86400 });
  return account;
}

export async function getCurrentPartnerSession() {
  const token = (await cookieStore()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return db.partnerAuthSession.findFirst({ where: { tokenHash: sha256(token), revokedAt: null, expiresAt: { gt: new Date() }, account: { status: "active" } }, include: { account: { include: { partner: { include: { profile: true, partnerType: true, codes: true } } } } } });
}
export async function requirePartnerSession() { const session = await getCurrentPartnerSession(); if (!session) redirect("/dang-nhap"); return session; }
export async function destroyPartnerSession() { const token = (await cookieStore()).get(COOKIE_NAME)?.value; if (token) await db.partnerAuthSession.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } }); (await cookieStore()).delete(COOKIE_NAME); }
export async function makePasswordHash(password: string) { return hashPassword(password); }

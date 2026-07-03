import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/mail";
import { getPublicAppBaseUrl } from "@/lib/public-url";

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

function getAppBaseUrl() { return getPublicAppBaseUrl(); }

function passwordResetEmail(link: string) {
  const text = [
    "Chào chị,",
    "",
    "Merly nhận được yêu cầu đặt lại mật khẩu cho tài khoản CTV.",
    `Đặt lại mật khẩu: ${link}`,
    "",
    "Link hết hạn sau 60 phút.",
    "Nếu chị không yêu cầu, vui lòng bỏ qua email này.",
    "",
    "Merly",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#292524">
      <p>Chào chị,</p>
      <p>Merly nhận được yêu cầu đặt lại mật khẩu cho tài khoản CTV.</p>
      <p><a href="${link}" style="display:inline-block;border-radius:12px;background:#be123c;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:700">Đặt lại mật khẩu</a></p>
      <p>Nếu nút không hoạt động, chị có thể mở link này:</p>
      <p style="word-break:break-all"><a href="${link}">${link}</a></p>
      <p>Link hết hạn sau 60 phút.</p>
      <p>Nếu chị không yêu cầu, vui lòng bỏ qua email này.</p>
      <p>Merly</p>
    </div>`;
  return { html, text };
}

export async function createPasswordResetTokenForLogin(login: string) {
  const normalized = normalizeLogin(login);
  const loginType = normalized.email ? "email" : "phone";
  const account = await db.partnerAccount.findFirst({ where: { OR: [{ email: normalized.email ?? "__none__" }, { phone: normalized.phone ?? "__none__" }] } });
  const eligibleAccount = account && account.status !== "disabled" ? account : null;
  const logBase = {
    loginType,
    accountMatched: Boolean(eligibleAccount),
    accountHasEmail: Boolean(eligibleAccount?.email),
  };

  if (!eligibleAccount) {
    console.info("[forgot-password] result", { ...logBase, emailSendOk: false, emailSkippedReason: "no_eligible_account" });
    return { tokenCreated: false, email: { ok: false, skipped: true, reason: "No eligible account." } };
  }

  const token = await generateSetupPasswordToken(eligibleAccount.id, "reset_password");
  if (!eligibleAccount.email) {
    console.info("[forgot-password] result", { ...logBase, emailSendOk: false, emailSkippedReason: "account_has_no_email" });
    return { tokenCreated: true, email: { ok: false, skipped: true, reason: "Account has no email." } };
  }

  const link = `${getAppBaseUrl()}/dat-lai-mat-khau?token=${encodeURIComponent(token)}`;
  const content = passwordResetEmail(link);
  const email = await sendTransactionalEmail({ to: eligibleAccount.email, subject: "Đặt lại mật khẩu CTV Merly", ...content });
  if (email.ok) {
    console.info("[forgot-password] result", { ...logBase, emailSendOk: true, providerMessageId: email.messageId });
  } else if (email.skipped) {
    console.info("[forgot-password] result", { ...logBase, emailSendOk: false, emailSkippedReason: email.reason });
  } else {
    console.warn("[forgot-password] result", { ...logBase, emailSendOk: false, errorCode: email.details?.code, errorMessage: email.error });
  }
  return { tokenCreated: true, email };
}

export async function sendPartnerWelcomeSetupEmail(input: { accountId: string; to: string; name: string; referralCode?: string }) {
  const token = await generateSetupPasswordToken(input.accountId, "setup_password");
  const setupLink = `${getAppBaseUrl()}/thiet-lap-mat-khau?token=${encodeURIComponent(token)}`;
  const referralLink = input.referralCode ? `${getAppBaseUrl()}/?ref=${encodeURIComponent(input.referralCode)}` : undefined;
  const lines = [
    `Chào chị ${input.name},`,
    "",
    "Merly đã duyệt hồ sơ CTV của chị.",
    `Thiết lập mật khẩu: ${setupLink}`,
    input.referralCode ? `Mã giới thiệu: ${input.referralCode}` : undefined,
    referralLink ? `Link giới thiệu: ${referralLink}` : undefined,
    "",
    "Chính sách hoa hồng được tính theo đơn hợp lệ.",
    "",
    "Merly",
  ].filter(Boolean).join("\n");
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#292524"><p>Chào chị ${input.name},</p><p>Merly đã duyệt hồ sơ CTV của chị.</p><p><a href="${setupLink}" style="display:inline-block;border-radius:12px;background:#be123c;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:700">Thiết lập mật khẩu</a></p><p>Nếu nút không hoạt động, chị mở link này:</p><p style="word-break:break-all"><a href="${setupLink}">${setupLink}</a></p>${input.referralCode ? `<p>Mã giới thiệu: <strong>${input.referralCode}</strong></p>` : ""}${referralLink ? `<p>Link giới thiệu: <a href="${referralLink}">${referralLink}</a></p>` : ""}<p>Chính sách hoa hồng được tính theo đơn hợp lệ.</p><p>Merly</p></div>`;
  const email = await sendTransactionalEmail({ to: input.to, subject: "Chào mừng chị đến với CTV Merly", text: lines, html });
  return { setupLink, email };
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

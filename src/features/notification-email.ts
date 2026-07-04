"server-only";

import { db, hasDatabaseUrl } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/mail";
import { appUrl } from "@/lib/public-url";

export const NOTIFICATION_EMAIL_SETTINGS_KEY = "notification_email_settings";

export type NotificationEmailSettings = {
  adminEmailAlertsEnabled: boolean;
  adminAlertEmails: string[];
  partnerEmailAlertsEnabled: boolean;
  emailImportantAnnouncementsToPartners: boolean;
  emailTrainingAnnouncementsToPartners: boolean;
  emailCampaignAnnouncementsToPartners: boolean;
  emailDigestEnabled: boolean;
  emailDigestFrequency: "daily" | "weekly";
};

export const DEFAULT_NOTIFICATION_EMAIL_SETTINGS: NotificationEmailSettings = {
  adminEmailAlertsEnabled: true,
  adminAlertEmails: ["tinnguyengcs@gmail.com"],
  partnerEmailAlertsEnabled: true,
  emailImportantAnnouncementsToPartners: true,
  emailTrainingAnnouncementsToPartners: false,
  emailCampaignAnnouncementsToPartners: true,
  emailDigestEnabled: false,
  emailDigestFrequency: "daily",
};

export type EmailAlertResult = { attempted: number; sent: number; failed: number; skippedReason?: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmailList(value: string) {
  return Array.from(new Set(value.split(/[;,\n]/).map((v) => v.trim().toLowerCase()).filter(Boolean)));
}
export function invalidEmails(emails: string[]) { return emails.filter((email) => !EMAIL_RE.test(email)); }
function esc(value: unknown) { return String(value ?? "").replace(/[&<>\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] ?? ch)); }
function textFromLines(lines: string[], actionUrl?: string) { return [...lines, ...(actionUrl ? ["", `Mở xử lý: ${actionUrl}`] : []), "", "Merly Partner System"].join("\n"); }
function htmlFromLines(lines: string[], actionUrl?: string) { return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#292524">${lines.map((l) => `<p>${esc(l)}</p>`).join("")}${actionUrl ? `<p><a href="${esc(actionUrl)}" style="display:inline-block;background:#9f1239;color:white;padding:10px 14px;border-radius:999px;text-decoration:none">Mở xử lý</a></p>` : ""}<p>Merly Partner System</p></div>`; }

export function normalizeNotificationEmailSettings(value: unknown): NotificationEmailSettings {
  const input = (value && typeof value === "object" ? value : {}) as Partial<NotificationEmailSettings>;
  const emails = Array.isArray(input.adminAlertEmails) ? input.adminAlertEmails.map(String).map((e) => e.trim().toLowerCase()).filter(Boolean) : DEFAULT_NOTIFICATION_EMAIL_SETTINGS.adminAlertEmails;
  return {
    adminEmailAlertsEnabled: typeof input.adminEmailAlertsEnabled === "boolean" ? input.adminEmailAlertsEnabled : DEFAULT_NOTIFICATION_EMAIL_SETTINGS.adminEmailAlertsEnabled,
    adminAlertEmails: invalidEmails(emails).length ? DEFAULT_NOTIFICATION_EMAIL_SETTINGS.adminAlertEmails : Array.from(new Set(emails)),
    partnerEmailAlertsEnabled: typeof input.partnerEmailAlertsEnabled === "boolean" ? input.partnerEmailAlertsEnabled : DEFAULT_NOTIFICATION_EMAIL_SETTINGS.partnerEmailAlertsEnabled,
    emailImportantAnnouncementsToPartners: typeof input.emailImportantAnnouncementsToPartners === "boolean" ? input.emailImportantAnnouncementsToPartners : DEFAULT_NOTIFICATION_EMAIL_SETTINGS.emailImportantAnnouncementsToPartners,
    emailTrainingAnnouncementsToPartners: typeof input.emailTrainingAnnouncementsToPartners === "boolean" ? input.emailTrainingAnnouncementsToPartners : DEFAULT_NOTIFICATION_EMAIL_SETTINGS.emailTrainingAnnouncementsToPartners,
    emailCampaignAnnouncementsToPartners: typeof input.emailCampaignAnnouncementsToPartners === "boolean" ? input.emailCampaignAnnouncementsToPartners : DEFAULT_NOTIFICATION_EMAIL_SETTINGS.emailCampaignAnnouncementsToPartners,
    emailDigestEnabled: typeof input.emailDigestEnabled === "boolean" ? input.emailDigestEnabled : DEFAULT_NOTIFICATION_EMAIL_SETTINGS.emailDigestEnabled,
    emailDigestFrequency: input.emailDigestFrequency === "weekly" ? "weekly" : "daily",
  };
}

export async function getNotificationEmailSettings() {
  if (!hasDatabaseUrl()) return DEFAULT_NOTIFICATION_EMAIL_SETTINGS;
  const row = await db.partnerProgramSetting.findUnique({ where: { key: NOTIFICATION_EMAIL_SETTINGS_KEY } });
  return normalizeNotificationEmailSettings(row?.value);
}
export async function getAdminAlertRecipients() { return (await getNotificationEmailSettings()).adminAlertEmails; }

export async function sendAdminAlertEmail(input: { subject: string; lines: string[]; actionPath: string }) : Promise<EmailAlertResult> {
  try {
    const settings = await getNotificationEmailSettings();
    if (!settings.adminEmailAlertsEnabled) return { attempted: 0, sent: 0, failed: 0, skippedReason: "admin_email_alerts_disabled" };
    const recipients = settings.adminAlertEmails.filter((e) => EMAIL_RE.test(e));
    if (!recipients.length) return { attempted: 0, sent: 0, failed: 0, skippedReason: "no_admin_recipients" };
    const actionUrl = appUrl(input.actionPath).toString();
    let sent = 0, failed = 0;
    for (const to of recipients) {
      const result = await sendTransactionalEmail({ to, subject: input.subject, text: textFromLines(input.lines, actionUrl), html: htmlFromLines(input.lines, actionUrl) });
      if (result.ok) sent++; else failed++;
    }
    return { attempted: recipients.length, sent, failed };
  } catch (error) { console.warn("[admin-alert-email] failed", error); return { attempted: 0, sent: 0, failed: 1 }; }
}

export async function sendPartnerNotificationEmail(input: { partnerIds?: string[]; targetPartnerType?: string | null; category: "announcement" | "campaign" | "training" | "payout"; force?: boolean; title: string; summary: string; actionPath: string }) : Promise<EmailAlertResult> {
  try {
    const settings = await getNotificationEmailSettings();
    if (!settings.partnerEmailAlertsEnabled) return { attempted: 0, sent: 0, failed: 0, skippedReason: "partner_email_alerts_disabled" };
    if (input.category === "announcement" && !input.force && !settings.emailImportantAnnouncementsToPartners) return { attempted: 0, sent: 0, failed: 0, skippedReason: "important_announcements_email_disabled" };
    if (input.category === "campaign" && !input.force && !settings.emailCampaignAnnouncementsToPartners) return { attempted: 0, sent: 0, failed: 0, skippedReason: "campaign_email_disabled" };
    if (input.category === "training" && !input.force && !settings.emailTrainingAnnouncementsToPartners) return { attempted: 0, sent: 0, failed: 0, skippedReason: "training_email_disabled" };
    const partners = await db.partner.findMany({ where: { status: "approved", email: { not: null }, ...(input.partnerIds ? { id: { in: input.partnerIds } } : {}), ...(input.targetPartnerType ? { partnerType: { is: { code: input.targetPartnerType as never } } } : {}) }, select: { email: true, displayName: true } });
    const actionUrl = appUrl(input.actionPath).toString();
    let sent = 0, failed = 0;
    for (const p of partners) {
      if (!p.email || !EMAIL_RE.test(p.email)) continue;
      const lines = [`Chào chị ${p.displayName},`, input.title, input.summary, "", "Merly Shoes"];
      const result = await sendTransactionalEmail({ to: p.email, subject: input.title, text: textFromLines(lines, actionUrl), html: htmlFromLines(lines, actionUrl) });
      if (result.ok) sent++; else failed++;
    }
    return { attempted: partners.length, sent, failed, skippedReason: partners.length ? undefined : "no_matching_partner_recipients" };
  } catch (error) { console.warn("[partner-notification-email] failed", error); return { attempted: 0, sent: 0, failed: 1 }; }
}

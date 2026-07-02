import nodemailer from "nodemailer";

type EmailInput = { to: string; subject: string; html: string; text: string };
export type SmtpErrorStage = "verify" | "sendMail";
export type SafeSmtpErrorDetails = { stage: SmtpErrorStage; name: string; code?: string; command?: string; responseCode?: number; response?: string; message: string };
type EmailResult = { ok: true; skipped: false; messageId?: string } | { ok: false; skipped: true; reason: string } | { ok: false; skipped: false; error: string; details?: SafeSmtpErrorDetails };
type VerifyResult = { ok: true; skipped: false } | { ok: false; skipped: true; reason: string } | { ok: false; skipped: false; error: string; details: SafeSmtpErrorDetails };

type SmtpConfig = { host: string; port: number; secure: boolean; user: string; pass: string; from: string };
export type SmtpRuntimeDiagnostics = {
  configured: boolean;
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  from: string | null;
  passwordPresent: boolean;
  passwordTrimWouldChange: boolean;
  fromHasLiteralQuotes: boolean;
  fromHasAngleBrackets: boolean;
  nodeEnv: string | null;
};

function getSmtpConfig(): SmtpConfig | null {
  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    String(process.env.SMTP_SECURE ?? "true").toLowerCase() === "true";

  const host = process.env.SMTP_HOST?.trim() || "smtp.hostinger.com";
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD ?? "";
  const from = process.env.SMTP_FROM?.trim() || user;

  if (!host || !Number.isFinite(port) || !user || !pass || !from) return null;
  return { host, port, secure, user, pass, from };
}

function createTransactionalEmailTransport(config: SmtpConfig) {
  const { host, port, secure, user, pass } = config;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: port === 587,
    tls: {
      servername: host,
      minVersion: "TLSv1.2",
    },
  });
}

export function getSmtpRuntimeDiagnostics(): SmtpRuntimeDiagnostics {
  const password = process.env.SMTP_PASSWORD ?? "";
  const rawFrom = process.env.SMTP_FROM ?? "";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    String(process.env.SMTP_SECURE ?? "true").toLowerCase() === "true";
  const host = process.env.SMTP_HOST?.trim() || "smtp.hostinger.com";
  const user = process.env.SMTP_USER?.trim() || null;
  const from = rawFrom.trim() || user;
  const passwordTrimWouldChange = password.length > 0 && password.trim() !== password;

  return {
    configured: Boolean(getSmtpConfig()),
    host,
    port,
    secure,
    user,
    from,
    passwordPresent: password.length > 0,
    passwordTrimWouldChange,
    fromHasLiteralQuotes: rawFrom.includes('"') || rawFrom.includes("'"),
    fromHasAngleBrackets: rawFrom.includes("<") || rawFrom.includes(">"),
    nodeEnv: process.env.NODE_ENV ?? null,
  };
}

function sanitizeSmtpText(value: string | undefined) {
  return value
    ?.replace(/[\r\n]+/g, " ")
    .replace(/(token=)[^\s&]+/gi, "$1[redacted]")
    .replace(/(password=)[^\s&]+/gi, "$1[redacted]")
    .replace(/(pass=)[^\s&]+/gi, "$1[redacted]")
    .replace(/(cookie:?)\s*[^;\s]+/gi, "$1 [redacted]")
    .slice(0, 500);
}

function toSafeSmtpErrorDetails(error: unknown, stage: SmtpErrorStage): SafeSmtpErrorDetails {
  const maybe = error as Partial<Error> & { code?: unknown; command?: unknown; responseCode?: unknown; response?: unknown };
  return {
    stage,
    name: maybe.name || "Error",
    code: typeof maybe.code === "string" ? maybe.code : undefined,
    command: typeof maybe.command === "string" ? maybe.command : undefined,
    responseCode: typeof maybe.responseCode === "number" ? maybe.responseCode : undefined,
    response: typeof maybe.response === "string" ? sanitizeSmtpText(maybe.response) : undefined,
    message: sanitizeSmtpText(maybe.message) || "Unknown SMTP error",
  };
}

export function getTransactionalEmailStatus() {
  const diagnostics = getSmtpRuntimeDiagnostics();
  return { ...diagnostics };
}

export function logSmtpTestConfig() {
  const { host, port, secure, user, from, passwordPresent, passwordTrimWouldChange, fromHasLiteralQuotes, fromHasAngleBrackets } = getSmtpRuntimeDiagnostics();
  console.info("[smtp-test] config", { host, port, secure, user, from, passwordPresent, passwordTrimWouldChange, fromHasLiteralQuotes, fromHasAngleBrackets });
}

export async function verifyTransactionalEmailTransport(): Promise<VerifyResult> {
  const config = getSmtpConfig();
  if (!config) return { ok: false, skipped: true, reason: "SMTP env is incomplete; verify skipped." };
  try {
    await createTransactionalEmailTransport(config).verify();
    return { ok: true, skipped: false };
  } catch (error) {
    const details = toSafeSmtpErrorDetails(error, "verify");
    return { ok: false, skipped: false, error: details.message, details };
  }
}

export async function sendTransactionalEmail(input: EmailInput): Promise<EmailResult> {
  const config = getSmtpConfig();
  if (!config) return { ok: false, skipped: true, reason: "SMTP env is incomplete; email delivery skipped." };
  const transporter = createTransactionalEmailTransport(config);
  try {
    await transporter.verify();
  } catch (error) {
    const details = toSafeSmtpErrorDetails(error, "verify");
    return { ok: false, skipped: false, error: details.message, details };
  }
  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true, skipped: false, messageId: info.messageId };
  } catch (error) {
    const details = toSafeSmtpErrorDetails(error, "sendMail");
    return { ok: false, skipped: false, error: details.message, details };
  }
}

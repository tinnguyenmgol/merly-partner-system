import net from "net";
import tls from "tls";

type EmailInput = { to: string; subject: string; html: string; text: string };
export type SmtpErrorStage = "verify" | "sendMail";
export type SafeSmtpErrorDetails = { stage: SmtpErrorStage; name: string; code?: string; command?: string; responseCode?: number; response?: string; message: string };
type EmailResult = { ok: true; skipped: false; messageId?: string } | { ok: false; skipped: true; reason: string } | { ok: false; skipped: false; error: string; details?: SafeSmtpErrorDetails };
type VerifyResult = { ok: true; skipped: false } | { ok: false; skipped: true; reason: string } | { ok: false; skipped: false; error: string; details: SafeSmtpErrorDetails };

type SmtpConfig = { host: string; port: number; secure: boolean; user: string; password: string; from: string };
export type SmtpRuntimeDiagnostics = {
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  from: string | null;
  passwordPresent: boolean;
  passwordLength: number;
  passwordHasLeadingOrTrailingWhitespace: boolean;
  fromHasLiteralQuotes: boolean;
  fromHasAngleBrackets: boolean;
  nodeEnv: string | null;
};

class SmtpCommandError extends Error {
  code = "ESMTP";
  constructor(message: string, public command?: string, public responseCode?: number, public response?: string) {
    super(message);
    this.name = "SmtpCommandError";
  }
}

function parsePort(value: string | undefined) {
  const port = Number(value ?? "");
  return Number.isFinite(port) ? port : null;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const port = parsePort(process.env.SMTP_PORT);
  const secure = process.env.SMTP_SECURE?.trim().toLowerCase() === "true";
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !port || !user || !password || !from) return null;
  return { host, port, secure, user, password, from };
}

export function getSmtpRuntimeDiagnostics(): SmtpRuntimeDiagnostics {
  const password = process.env.SMTP_PASSWORD ?? "";
  const rawFrom = process.env.SMTP_FROM ?? "";
  const port = parsePort(process.env.SMTP_PORT);
  return {
    configured: Boolean(getSmtpConfig()),
    host: process.env.SMTP_HOST?.trim() || null,
    port,
    secure: process.env.SMTP_SECURE?.trim().toLowerCase() === "true",
    user: process.env.SMTP_USER?.trim() || null,
    from: rawFrom.trim() || null,
    passwordPresent: password.length > 0,
    passwordLength: password.length,
    passwordHasLeadingOrTrailingWhitespace: password.length > 0 && password.trim() !== password,
    fromHasLiteralQuotes: rawFrom.includes('"') || rawFrom.includes("'"),
    fromHasAngleBrackets: rawFrom.includes("<") || rawFrom.includes(">"),
    nodeEnv: process.env.NODE_ENV ?? null,
  };
}

function encodeHeader(value: string) {
  return /[^\x20-\x7e]/.test(value) ? `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=` : value;
}

function extractEmail(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

function sanitizeHeader(value: string) { return value.replace(/[\r\n]+/g, " ").trim(); }
function dotStuff(value: string) { return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, ".."); }
function sanitizeSmtpText(value: string | undefined) { return value?.replace(/[\r\n]+/g, " ").replace(/(token=)[^\s&]+/gi, "$1[redacted]").replace(/(password=)[^\s&]+/gi, "$1[redacted]").replace(/(cookie:?)\s*[^;\s]+/gi, "$1 [redacted]").slice(0, 500); }

function buildMessage(config: SmtpConfig, input: EmailInput, boundary: string) {
  const from = sanitizeHeader(config.from);
  const to = sanitizeHeader(input.to);
  const subject = encodeHeader(sanitizeHeader(input.subject));
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

class SmtpClient {
  private socket: net.Socket | tls.TLSSocket;
  private buffer = "";

  constructor(private config: SmtpConfig) {
    this.socket = config.secure ? tls.connect({ host: config.host, port: config.port, servername: config.host }) : net.connect({ host: config.host, port: config.port });
    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => { this.buffer += chunk; });
  }

  private close() { this.socket.end(); this.socket.destroy(); }

  private waitForCode(expected: number | number[], command?: string) {
    const codes = Array.isArray(expected) ? expected : [expected];
    return new Promise<string>((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const lines = this.buffer.split("\r\n").filter(Boolean);
        const last = [...lines].reverse().find((line) => /^\d{3} /.test(line));
        if (last) {
          const code = Number(last.slice(0, 3));
          if (codes.includes(code)) { const response = this.buffer; this.buffer = ""; clearInterval(timer); resolve(response); }
          else if (code >= 400) { const response = this.buffer; this.buffer = ""; clearInterval(timer); reject(new SmtpCommandError(`SMTP command failed with ${code}`, command, code, response)); }
        }
        if (Date.now() - started > 15000) { clearInterval(timer); reject(new SmtpCommandError("SMTP command timed out", command)); }
      }, 25);
      this.socket.once("error", (error) => { clearInterval(timer); reject(error); });
    });
  }

  private async command(line: string, expected: number | number[], safeCommand = line) { this.socket.write(`${line}\r\n`); return this.waitForCode(expected, safeCommand); }

  async verify() {
    try {
      await this.waitForCode(220, "CONNECT");
      await this.command(`EHLO ${this.config.host}`, 250, "EHLO");
      await this.command("AUTH LOGIN", 334);
      await this.command(Buffer.from(this.config.user).toString("base64"), 334, "AUTH LOGIN USER");
      await this.command(Buffer.from(this.config.password).toString("base64"), 235, "AUTH LOGIN PASS");
      this.socket.write("QUIT\r\n");
    } finally {
      this.close();
    }
  }

  async send(input: EmailInput) {
    try {
      await this.waitForCode(220, "CONNECT");
      await this.command(`EHLO ${this.config.host}`, 250, "EHLO");
      await this.command("AUTH LOGIN", 334);
      await this.command(Buffer.from(this.config.user).toString("base64"), 334, "AUTH LOGIN USER");
      await this.command(Buffer.from(this.config.password).toString("base64"), 235, "AUTH LOGIN PASS");
      await this.command(`MAIL FROM:<${extractEmail(this.config.from)}>`, 250, "MAIL FROM");
      await this.command(`RCPT TO:<${extractEmail(input.to)}>`, [250, 251], "RCPT TO");
      await this.command("DATA", 354);
      const boundary = `merly-${Date.now().toString(36)}`;
      this.socket.write(`${dotStuff(buildMessage(this.config, input, boundary))}\r\n.\r\n`);
      const response = await this.waitForCode(250, "DATA");
      this.socket.write("QUIT\r\n");
      return response.match(/queued as\s+([^\s]+)/i)?.[1];
    } finally {
      this.close();
    }
  }
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
  const { host, port, secure, user, from, passwordPresent, passwordLength, passwordHasLeadingOrTrailingWhitespace, fromHasLiteralQuotes, fromHasAngleBrackets } = getSmtpRuntimeDiagnostics();
  console.info("[smtp-test] config", { host, port, secure, user, from, passwordPresent, passwordLength, passwordHasLeadingOrTrailingWhitespace, fromHasLiteralQuotes, fromHasAngleBrackets });
}

export async function verifyTransactionalEmailTransport(): Promise<VerifyResult> {
  const config = getSmtpConfig();
  if (!config) return { ok: false, skipped: true, reason: "SMTP env is incomplete; verify skipped." };
  try {
    await new SmtpClient(config).verify();
    return { ok: true, skipped: false };
  } catch (error) {
    const details = toSafeSmtpErrorDetails(error, "verify");
    return { ok: false, skipped: false, error: details.message, details };
  }
}

export async function sendTransactionalEmail(input: EmailInput): Promise<EmailResult> {
  const config = getSmtpConfig();
  if (!config) return { ok: false, skipped: true, reason: "SMTP env is incomplete; email delivery skipped." };
  try {
    await new SmtpClient(config).verify();
  } catch (error) {
    const details = toSafeSmtpErrorDetails(error, "verify");
    return { ok: false, skipped: false, error: details.message, details };
  }
  try {
    const messageId = await new SmtpClient(config).send(input);
    return { ok: true, skipped: false, messageId };
  } catch (error) {
    const details = toSafeSmtpErrorDetails(error, "sendMail");
    return { ok: false, skipped: false, error: details.message, details };
  }
}

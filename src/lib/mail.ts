import net from "net";
import tls from "tls";

type EmailInput = { to: string; subject: string; html: string; text: string };
type EmailResult = { ok: true; skipped: false; messageId?: string } | { ok: false; skipped: true; reason: string } | { ok: false; skipped: false; error: string };

type SmtpConfig = { host: string; port: number; secure: boolean; user: string; password: string; from: string };

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? "");
  const secure = process.env.SMTP_SECURE?.trim().toLowerCase() === "true";
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !Number.isFinite(port) || !user || !password || !from) return null;
  return { host, port, secure, user, password, from };
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

  private waitForCode(expected: number | number[]) {
    const codes = Array.isArray(expected) ? expected : [expected];
    return new Promise<string>((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const lines = this.buffer.split("\r\n").filter(Boolean);
        const last = [...lines].reverse().find((line) => /^\d{3} /.test(line));
        if (last) {
          const code = Number(last.slice(0, 3));
          if (codes.includes(code)) { const response = this.buffer; this.buffer = ""; clearInterval(timer); resolve(response); }
          else if (code >= 400) { clearInterval(timer); reject(new Error(`SMTP command failed with ${code}`)); }
        }
        if (Date.now() - started > 15000) { clearInterval(timer); reject(new Error("SMTP command timed out")); }
      }, 25);
      this.socket.once("error", (error) => { clearInterval(timer); reject(error); });
    });
  }

  private async command(line: string, expected: number | number[]) { this.socket.write(`${line}\r\n`); return this.waitForCode(expected); }

  async send(input: EmailInput) {
    await this.waitForCode(220);
    await this.command(`EHLO ${this.config.host}`, 250);
    await this.command("AUTH LOGIN", 334);
    await this.command(Buffer.from(this.config.user).toString("base64"), 334);
    await this.command(Buffer.from(this.config.password).toString("base64"), 235);
    await this.command(`MAIL FROM:<${extractEmail(this.config.from)}>`, 250);
    await this.command(`RCPT TO:<${extractEmail(input.to)}>`, [250, 251]);
    await this.command("DATA", 354);
    const boundary = `merly-${Date.now().toString(36)}`;
    this.socket.write(`${dotStuff(buildMessage(this.config, input, boundary))}\r\n.\r\n`);
    const response = await this.waitForCode(250);
    this.socket.write("QUIT\r\n");
    this.socket.end();
    return response.match(/queued as\s+([^\s]+)/i)?.[1];
  }
}

export function getTransactionalEmailStatus() {
  const config = getSmtpConfig();
  return { configured: Boolean(config), from: config?.from ?? process.env.SMTP_FROM ?? null, host: config?.host ?? process.env.SMTP_HOST ?? null };
}

export async function sendTransactionalEmail(input: EmailInput): Promise<EmailResult> {
  const config = getSmtpConfig();
  if (!config) return { ok: false, skipped: true, reason: "SMTP env is incomplete; email delivery skipped." };
  try {
    const messageId = await new SmtpClient(config).send(input);
    return { ok: true, skipped: false, messageId };
  } catch (error) {
    return { ok: false, skipped: false, error: error instanceof Error ? error.message : "Unknown SMTP error" };
  }
}

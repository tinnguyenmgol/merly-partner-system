declare module "nodemailer" {
  export type SentMessageInfo = { messageId?: string };

  export type Transporter = {
    verify(): Promise<true>;
    sendMail(message: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    }): Promise<SentMessageInfo>;
  };

  export function createTransport(options: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    requireTLS: boolean;
    tls: { servername: string; minVersion: "TLSv1.2" };
  }): Transporter;

  const nodemailer: { createTransport: typeof createTransport };
  export default nodemailer;
}

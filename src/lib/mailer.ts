/**
 * NEXUS mail delivery — nodemailer over SMTP.
 *
 * The outbox drain worker claims QUEUED rows and hands each to sendMail():
 *  - SMTP_HOST set            → live delivery through the configured relay
 *                                (branded HTML + plain-text fallback)
 *  - SMTP_HOST unset (sandbox)→ the drain marks rows SENT immediately; the
 *                                delivery is simulated so the console state
 *                                machine stays testable without a relay
 *
 * Configuration (all optional except SMTP_HOST for live mode):
 *  SMTP_HOST    e.g. smtp.gmail.com · in-v3.mailjet.com · localhost
 *  SMTP_PORT    default 587 (STARTTLS) — use 465 with SMTP_SECURE=true
 *  SMTP_SECURE  "true" for implicit TLS (465), default STARTTLS/opportunistic
 *  SMTP_USER    auth user (omit for relays that don't require auth)
 *  SMTP_PASS    auth password
 *  MAIL_FROM    "NEXUS Recruitments <recruitment@nexusvit.in>"
 */
import nodemailer from "nodemailer";

const MAIL_FROM =
  process.env.MAIL_FROM ?? "NEXUS Recruitments <recruitment@nexusvit.in>";

/** Capability hint for the console — never leaks credentials. */
export function getMailProvider(): "smtp" | "sandbox" {
  return process.env.SMTP_HOST ? "smtp" : "sandbox";
}

/** Cached transport — reused across drains in the same server process. */
let cachedTransport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
  if (cachedTransport) return cachedTransport;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure =
    (process.env.SMTP_SECURE ?? "").toLowerCase() === "true" || port === 465;
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });
  return cachedTransport;
}

/**
 * Deliver one message. Throws on failure — the caller (drain worker) is
 * responsible for marking the outbox row FAILED with the error message.
 */
export async function sendMail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!process.env.SMTP_HOST) {
    throw new Error("smtp not configured (SMTP_HOST unset)");
  }
  const transport = getTransport();
  await transport.sendMail({
    from: MAIL_FROM,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: renderEmailHtml(params.subject, params.text),
  });
}

/** Terminal-flavoured HTML wrapper so SMTP mail renders branded. */
export function renderEmailHtml(subject: string, bodyText: string): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#05080d;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:ui-monospace,Menlo,Consolas,monospace;">
    <div style="border:1px solid #17263c;background:#070d16;padding:20px 22px;">
      <p style="margin:0 0 14px;font-size:11px;letter-spacing:3px;color:#60a5fa;">NEXUS<span style="color:#d7e2ee;">_</span> <span style="color:#7d8fa5;">// RECRUITMENTS '26 · VIT CHENNAI</span></p>
      <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#d7e2ee;">${esc(subject)}</p>
      <pre style="margin:0;white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.7;color:#c4d2e2;">${esc(bodyText)}</pre>
      <p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #17263c;font-size:10px;letter-spacing:2px;color:#7d8fa5;">STATUS PAGE → nexus.runs-on.dev/apply</p>
    </div>
  </div>
</body></html>`;
}

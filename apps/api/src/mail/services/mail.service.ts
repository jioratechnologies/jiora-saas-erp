import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface SendInvitationParams {
  to: string;
  displayName: string;
  tenantName: string;
  roleNames?: string[];
  isOwner?: boolean;
  departmentName?: string | null;
  designationName?: string | null;
  isAdmin?: boolean;
}

const escapeHtml = (v: string): string =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly fromAddress: string;
  private readonly webBaseUrl: string;

  constructor() {
    // Explicit SMTP_* wins. Otherwise RESEND_API_KEY alone is enough: Resend's
    // SMTP relay takes the fixed user "resend" and the API key as password.
    const useResend = !process.env.SMTP_HOST && !!process.env.RESEND_API_KEY;
    const host = useResend ? "smtp.resend.com" : process.env.SMTP_HOST;
    const port = useResend ? 465 : Number.parseInt(process.env.SMTP_PORT || "587", 10);
    const user = useResend ? "resend" : process.env.SMTP_USER;
    const pass = useResend ? process.env.RESEND_API_KEY : process.env.SMTP_PASSWORD;
    const secure = useResend || process.env.SMTP_SECURE === "true" || port === 465;

    const resendFrom = process.env.RESEND_FROM_ADDRESS
      ? `"${(process.env.RESEND_FROM_NAME || "Jiora SaaS ERP").replace(/"/g, "")}" <${process.env.RESEND_FROM_ADDRESS}>`
      : undefined;
    this.fromAddress =
      process.env.SMTP_FROM ||
      resendFrom ||
      `"Jiora SaaS ERP" <no-reply@${process.env.WEB_DOMAIN || "saaserp.jioratech.com"}>`;

    this.webBaseUrl =
      process.env.WEB_BASE_URL ||
      process.env.APP_PUBLIC_URL ||
      (process.env.WEB_DOMAIN ? `https://${process.env.WEB_DOMAIN}` : "https://saaserp.jioratech.com");

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
        });
        this.logger.log(`SMTP transporter initialized with host: ${host}:${port}`);
      } catch (err: any) {
        this.logger.warn(`Failed to initialize SMTP transporter: ${err.message}`);
        this.transporter = null;
      }
    } else {
      this.logger.log(
        "SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASSWORD not set). Invitation links will be logged to server console.",
      );
    }
  }

  /**
   * Sends an invitation email to a newly invited tenant member or owner.
   */
  async sendInvitation(params: SendInvitationParams): Promise<{ success: boolean; previewUrl?: string }> {
    const { to, displayName, tenantName, roleNames = [], isOwner = false, departmentName, designationName, isAdmin = false } = params;
    const e = escapeHtml;
    const eTenant = e(tenantName);
    const eName = e(displayName || "there");
    const eTo = e(to);
    const loginUrl = `${this.webBaseUrl}/login?email=${encodeURIComponent(to)}`;
    const roleText = isOwner || isAdmin ? "Organisation admin" : roleNames.length > 0 ? roleNames.join(", ") : "Team Member";
    const eRole = e(roleText);
    const extraRows = [
      departmentName ? ["Department", departmentName] : null,
      designationName ? ["Designation", designationName] : null,
    ].filter((r): r is string[] => r !== null);
    const extraHtml = extraRows
      .map(([l, v]) => `<div class="pill-row"><span class="pill-label">${l}:</span><span class="pill-value">${e(v)}</span></div>`)
      .join("\n        ");
    const extraText = extraRows.map(([l, v]) => `${l}: ${v}`).join("\n");

    const subject = `You've been invited to join ${tenantName} on SaaS ERP`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px; color: #18181b; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #e4e4e7; }
    .header { background: linear-gradient(135deg, #18181b 0%, #27272a 100%); padding: 32px 28px; text-align: center; }
    .logo-badge { display: inline-block; background: #3b82f6; color: #ffffff; font-weight: 800; font-size: 16px; padding: 8px 14px; border-radius: 10px; margin-bottom: 12px; letter-spacing: 0.5px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
    .content { padding: 32px 28px; line-height: 1.6; }
    .greeting { font-size: 16px; font-weight: 600; color: #18181b; margin-bottom: 16px; }
    .message { font-size: 14px; color: #52525b; margin-bottom: 24px; }
    .pill-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 28px; }
    .pill-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .pill-row:last-child { margin-bottom: 0; }
    .pill-label { color: #64748b; font-weight: 500; }
    .pill-value { color: #0f172a; font-weight: 600; }
    .cta-container { text-align: center; margin-bottom: 28px; }
    .cta-button { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25); }
    .note { font-size: 12px; color: #71717a; border-top: 1px solid #f4f4f5; padding-top: 20px; margin-top: 20px; }
    .footer { background: #fafafa; padding: 20px 28px; text-align: center; font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">SaaS ERP</div>
      <h1>Invitation to Join ${eTenant}</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi ${eName},</div>
      <div class="message">
        You have been invited to join <strong>${eTenant}</strong> on the SaaS ERP platform.
      </div>
      <div class="pill-card">
        <div class="pill-row">
          <span class="pill-label">Organization:</span>
          <span class="pill-value">${eTenant}</span>
        </div>
        <div class="pill-row">
          <span class="pill-label">Invited Role:</span>
          <span class="pill-value">${eRole}</span>
        </div>
        ${extraHtml}
        <div class="pill-row">
          <span class="pill-label">Email Account:</span>
          <span class="pill-value">${eTo}</span>
        </div>
      </div>
      <div class="cta-container">
        <a href="${e(loginUrl)}" class="cta-button" target="_blank">Accept Invitation &amp; Sign In</a>
      </div>
      <div class="note">
        <strong>Getting started</strong>
        <ol style="margin: 8px 0 0; padding-left: 18px;">
          <li>Sign in with this email address (<strong>${eTo}</strong>).</li>
          <li>Complete your profile: phone, gender and date of birth.</li>
          <li>Start using attendance and leave.</li>
        </ol>
      </div>
    </div>
    <div class="footer">
      This is an automated message from Jiora SaaS ERP. If you were not expecting this invitation, you can safely disregard this email.
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Hi ${displayName || "there"},

You have been invited to join ${tenantName} on SaaS ERP as ${roleText}.
${extraText ? extraText + "\n" : ""}
Accept invitation / Sign in:
${loginUrl}

Steps:
1. Sign in with this email address (${to}).
2. Complete your profile: phone, gender and date of birth.
3. Start using attendance and leave.

— Jiora SaaS ERP
    `.trim();

    if (!this.transporter) {
      this.logger.log(`[SIMULATED EMAIL DISPATCH] To: ${to} | Subject: "${subject}" | Accept Link: ${loginUrl}`);
      return { success: true, previewUrl: loginUrl };
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });
      this.logger.log(`[EMAIL SENT] Successfully dispatched invitation email to ${to} (${tenantName})`);
      return { success: true };
    } catch (err: any) {
      this.logger.error(`[EMAIL ERROR] Failed to send invitation email to ${to}: ${err.message}`, err.stack);
      // We log but do not bubble error so the user creation still succeeds in DB
      return { success: false };
    }
  }
}

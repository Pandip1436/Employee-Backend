import nodemailer from "nodemailer";
import CompanySettings from "../models/CompanySettings";
import { ApiError } from "../utils/ApiError";

/** Admin-supplied text (certificate notes, names) is interpolated into HTML mails. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Logo shown in every email header. Set EMAIL_LOGO_URL to a public https image,
// or it falls back to <CLIENT_URL>/logo.png. Empty → header renders text-only.
const LOGO_URL =
  process.env.EMAIL_LOGO_URL ||
  (process.env.CLIENT_URL ? `${process.env.CLIENT_URL.replace(/\/+$/, "")}/logo.png` : "");

/** Branded header band: logo (if configured) + title. Inline styles for email-client support. */
function emailHeader(title: string, bgColor: string): string {
  const logo = LOGO_URL
    ? `<img src="${LOGO_URL}" alt="" height="28" style="height:28px;width:auto;vertical-align:middle;margin-right:10px;border-radius:6px;background:rgba(255,255,255,0.18);padding:3px;" />`
    : "";
  return `<div style="background: ${bgColor}; padding: 16px 24px;">${logo}<h2 style="display:inline-block;vertical-align:middle;color:#fff;margin:0;font-size:18px;">${title}</h2></div>`;
}

async function getAdminEmails(): Promise<string[]> {
  // Prefer the editable list from Company Settings; fall back to env.
  try {
    const settings = await CompanySettings.findOne().select("notificationEmails").lean();
    const fromDb = ((settings as any)?.notificationEmails || [])
      .map((e: string) => String(e).trim())
      .filter(Boolean);
    if (fromDb.length) return fromDb;
  } catch {
    // ignore, fall through to env
  }
  const fromEnv = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  return fromEnv;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/** Format a fractional-hours value as "7h 28m" (rounded to the nearest minute). */
function formatHours(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

/* ─── Template Engine ─── */

/**
 * Replaces {{variable}} placeholders in a template string.
 * Example: render("Hi {{name}}", { name: "John" }) → "Hi John"
 */
function render(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`;
  });
}

/**
 * Loads a template from CompanySettings DB by key.
 * Returns null if not found — caller should fall back to defaults.
 */
async function loadTemplate(
  key: string
): Promise<{ subject: string; body: string } | null> {
  try {
    const settings = await CompanySettings.findOne();
    if (!settings || !settings.emailTemplates) return null;
    const tpl = settings.emailTemplates.find((t: any) => t.key === key);
    if (!tpl || !tpl.subject || !tpl.body) return null;
    return { subject: tpl.subject, body: tpl.body };
  } catch (e) {
    console.error("Failed to load email template:", (e as Error).message);
    return null;
  }
}

/**
 * Wraps a body in the standard email layout (header + footer)
 * if the template body doesn't already include full HTML structure.
 */
function wrapLayout(body: string, headerColor = "#4f46e5", title = "Notification"): string {
  // If template already has <html> or <div> at root, use as-is
  if (body.trim().startsWith("<html") || body.trim().startsWith("<!DOCTYPE")) {
    return body;
  }
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      ${emailHeader(title, headerColor)}
      <div style="padding: 24px; color: #111827; font-size: 14px; line-height: 1.6;">
        ${body}
      </div>
      <div style="background: #f9fafb; padding: 12px 24px; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">United Nexa Tech — Employee Portal</p>
      </div>
    </div>
  `;
}

/**
 * Core send function — used by all notification methods.
 * Loads template from DB, renders variables, falls back to default if missing.
 */
async function sendTemplatedEmail(
  templateKey: string,
  vars: Record<string, string | number>,
  fallback: { subject: string; html: string },
  headerColor = "#4f46e5"
): Promise<void> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return;

  const tpl = await loadTemplate(templateKey);

  let subject: string;
  let html: string;

  if (tpl) {
    subject = render(tpl.subject, vars);
    const renderedBody = render(tpl.body, vars);
    html = wrapLayout(renderedBody, headerColor, subject);
  } else {
    subject = fallback.subject;
    html = fallback.html;
  }

  try {
    await transporter.sendMail({
      from: `"United Nexa Tech" <${process.env.SMTP_USER}>`,
      to: adminEmails.join(", "),
      subject,
      html,
    });
    console.log(`[email] sent: ${templateKey}`);
  } catch (error) {
    console.error(`[email] failed: ${templateKey}:`, (error as Error).message);
  }
}

/* ─── Public API ─── */

export class EmailService {
  static async sendClockInNotification(
    employeeName: string,
    employeeEmail: string,
    clockInTime: Date
  ) {
    const vars = {
      employeeName,
      employeeEmail,
      date: formatDate(clockInTime),
      clockInTime: formatTime(clockInTime),
    };

    const fallbackHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        ${emailHeader("Clock In Notification", "#4f46e5")}
        <div style="padding: 24px;">
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <p style="margin: 0; color: #15803d; font-weight: 600;">Employee has clocked in</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Employee</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${employeeName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${employeeEmail}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${vars.date}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Clock In</td><td style="padding: 8px 0; color: #22c55e; font-size: 16px; font-weight: 700;">${vars.clockInTime}</td></tr>
          </table>
        </div>
        <div style="background: #f9fafb; padding: 12px 24px; text-align: center;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">United Nexa Tech — Employee Portal</p>
        </div>
      </div>
    `;

    await sendTemplatedEmail(
      "clock_in_notification",
      vars,
      {
        subject: `Clock In: ${employeeName} — ${vars.clockInTime}`,
        html: fallbackHtml,
      },
      "#4f46e5"
    );
  }

  static async sendClockOutNotification(
    employeeName: string,
    employeeEmail: string,
    clockInTime: Date,
    clockOutTime: Date,
    totalHours: number
  ) {
    const vars = {
      employeeName,
      employeeEmail,
      date: formatDate(clockOutTime),
      clockInTime: formatTime(clockInTime),
      clockOutTime: formatTime(clockOutTime),
      totalHours: formatHours(totalHours),
    };

    const fallbackHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        ${emailHeader("Clock Out Notification", "#4f46e5")}
        <div style="padding: 24px;">
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <p style="margin: 0; color: #dc2626; font-weight: 600;">Employee has clocked out</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Employee</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${employeeName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${employeeEmail}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${vars.date}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Clock In</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${vars.clockInTime}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Clock Out</td><td style="padding: 8px 0; color: #ef4444; font-size: 16px; font-weight: 700;">${vars.clockOutTime}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Total Hours</td><td style="padding: 8px 0; color: #4f46e5; font-size: 16px; font-weight: 700;">${vars.totalHours}</td></tr>
          </table>
        </div>
        <div style="background: #f9fafb; padding: 12px 24px; text-align: center;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">United Nexa Tech — Employee Portal</p>
        </div>
      </div>
    `;

    await sendTemplatedEmail(
      "clock_out_notification",
      vars,
      {
        subject: `Clock Out: ${employeeName} — ${formatHours(totalHours)} worked`,
        html: fallbackHtml,
      },
      "#4f46e5"
    );
  }

  /**
   * Auto clock-out notice — sent when the daily cron closes an open attendance
   * record because the employee forgot to clock out. Goes to BOTH the employee
   * (so they know) and the admin notification list.
   */
  static async sendAutoClockOutNotification(
    employeeName: string,
    employeeEmail: string,
    clockInTime: Date,
    clockOutTime: Date,
    totalHours: number
  ) {
    const vars = {
      employeeName,
      employeeEmail,
      date: formatDate(clockOutTime),
      clockInTime: formatTime(clockInTime),
      clockOutTime: formatTime(clockOutTime),
      totalHours: formatHours(totalHours),
    };

    // ── Admin notification (templated → admin list) ──
    const adminFallbackHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        ${emailHeader("Auto Clock-Out", "#f59e0b")}
        <div style="padding: 24px;">
          <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <p style="margin: 0; color: #b45309; font-weight: 600;">Employee was auto clocked-out (no manual clock-out)</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Employee</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${employeeName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${employeeEmail}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${vars.date}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Clock In</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${vars.clockInTime}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Auto Clock Out</td><td style="padding: 8px 0; color: #f59e0b; font-size: 16px; font-weight: 700;">${vars.clockOutTime}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Total Hours</td><td style="padding: 8px 0; color: #4f46e5; font-size: 16px; font-weight: 700;">${vars.totalHours}</td></tr>
          </table>
        </div>
        <div style="background: #f9fafb; padding: 12px 24px; text-align: center;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">United Nexa Tech — Employee Portal</p>
        </div>
      </div>
    `;

    await sendTemplatedEmail(
      "auto_clock_out_notification",
      vars,
      {
        subject: `Auto Clock-Out: ${employeeName} — ${vars.totalHours}`,
        html: adminFallbackHtml,
      },
      "#f59e0b"
    );

    // ── Employee notification (direct → the employee) ──
    const employeeHtml = wrapLayout(
      `
      <p style="margin: 0 0 16px 0; color: #111827; font-size: 15px;">Hi ${employeeName},</p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 1.6;">
        You didn't clock out today, so the system automatically clocked you out at
        <strong>${vars.clockOutTime}</strong> on ${vars.date}.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px; width: 130px;">Clock In</td><td style="padding: 6px 0; color: #111827; font-size: 14px;">${vars.clockInTime}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Auto Clock Out</td><td style="padding: 6px 0; color: #f59e0b; font-size: 15px; font-weight: 700;">${vars.clockOutTime}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Total Hours</td><td style="padding: 6px 0; color: #4f46e5; font-size: 15px; font-weight: 700;">${vars.totalHours}</td></tr>
      </table>
      <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
        Please remember to clock out at the end of your day. If this looks wrong, contact your administrator.
      </p>
      `,
      "#f59e0b",
      "Auto Clock-Out"
    );

    try {
      await transporter.sendMail({
        from: `"United Nexa Tech" <${process.env.SMTP_USER}>`,
        to: employeeEmail,
        subject: `You were auto clocked-out at ${vars.clockOutTime}`,
        html: employeeHtml,
      });
      console.log(`[email] auto clock-out sent to ${employeeEmail}`);
    } catch (error) {
      console.error(`[email] auto clock-out (employee) failed:`, (error as Error).message);
    }
  }

  static async sendLateAlertNotification(
    employeeName: string,
    employeeEmail: string,
    clockInTime: Date,
    lateByMinutes: number
  ) {
    const hours = Math.floor(lateByMinutes / 60);
    const mins = lateByMinutes % 60;
    const lateDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`;
    const officeTime = process.env.OFFICE_START_TIME || "09:15";

    const vars = {
      employeeName,
      employeeEmail,
      date: formatDate(clockInTime),
      clockInTime: formatTime(clockInTime),
      officeTime: `${officeTime} AM`,
      lateDuration,
      lateByMinutes,
    };

    const fallbackHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        ${emailHeader("Late Login Alert", "#dc2626")}
        <div style="padding: 24px;">
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <p style="margin: 0; color: #dc2626; font-weight: 600;">Employee arrived late by ${lateDuration}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 130px;">Employee</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${employeeName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${employeeEmail}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${vars.date}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Office Start</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${vars.officeTime}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Actual Clock In</td><td style="padding: 8px 0; color: #dc2626; font-size: 16px; font-weight: 700;">${vars.clockInTime}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Late By</td><td style="padding: 8px 0; color: #dc2626; font-size: 16px; font-weight: 700;">${lateDuration}</td></tr>
          </table>
        </div>
        <div style="background: #f9fafb; padding: 12px 24px; text-align: center;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">United Nexa Tech — Employee Portal</p>
        </div>
      </div>
    `;

    await sendTemplatedEmail(
      "late_alert_notification",
      vars,
      {
        subject: `LATE ALERT: ${employeeName} — late by ${lateDuration}`,
        html: fallbackHtml,
      },
      "#dc2626"
    );
  }

  /**
   * Friday reminder for employees who haven't submitted their weekly timesheet.
   * Sent directly to the employee (not admins).
   */
  static async sendTimesheetReminder(
    employeeName: string,
    employeeEmail: string,
    weekLabel: string
  ) {
    const html = wrapLayout(
      `
      <p style="margin: 0 0 16px 0; color: #111827; font-size: 15px;">Hi ${employeeName},</p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 1.6;">
        Your timesheet for <strong>${weekLabel}</strong> hasn't been submitted yet. Please log in and submit it before end of day.
      </p>
      <a href="${process.env.CLIENT_URL || "#"}/timesheet/weekly" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Submit Timesheet</a>
      `,
      "#f59e0b",
      "Timesheet Reminder"
    );

    try {
      await transporter.sendMail({
        from: `"United Nexa Tech" <${process.env.SMTP_USER}>`,
        to: employeeEmail,
        subject: `Reminder: Submit your timesheet for ${weekLabel}`,
        html,
      });
      console.log(`[email] timesheet reminder sent to ${employeeEmail}`);
    } catch (error) {
      console.error(`[email] timesheet reminder failed:`, (error as Error).message);
    }
  }

  /**
   * Delivers an internship completion certificate to the intern, PDF attached.
   * Unlike the notification mails above this one is triggered by an admin action,
   * so a delivery failure is thrown rather than swallowed — the admin needs to
   * know the certificate never left the building.
   */
  static async sendInternCertificate(opts: {
    to: string;
    internName: string;
    companyName: string;
    certificateNo: string;
    startDate: string;
    endDate: string;
    message?: string;
    attachment: { filename: string; content: Buffer };
  }): Promise<void> {
    const note = opts.message?.trim()
      ? `<div style="margin: 0 0 16px 0; border-left: 3px solid #14b8a6; background: #f0fdfa; padding: 12px 16px; border-radius: 0 8px 8px 0; color: #115e59; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(opts.message.trim())}</div>`
      : "";

    const html = wrapLayout(
      `
      <p style="margin: 0 0 16px 0; color: #111827; font-size: 15px;">Dear ${escapeHtml(opts.internName)},</p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 1.6;">
        Congratulations on completing your internship with <strong>${escapeHtml(opts.companyName)}</strong>.
        Your certificate of completion is attached to this email as a PDF.
      </p>
      ${note}
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">Certificate No.</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${escapeHtml(opts.certificateNo)}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Internship Term</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${escapeHtml(opts.startDate)} → ${escapeHtml(opts.endDate)}</td></tr>
      </table>
      <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
        We wish you the very best for everything ahead.
      </p>
      `,
      "#0f766e",
      "Internship Certificate"
    );

    try {
      await transporter.sendMail({
        from: `"${opts.companyName}" <${process.env.SMTP_USER}>`,
        to: opts.to,
        subject: `Your Internship Certificate — ${opts.companyName}`,
        html,
        attachments: [
          {
            filename: opts.attachment.filename,
            content: opts.attachment.content,
            contentType: "application/pdf",
          },
        ],
      });
      console.log(`[email] intern certificate sent to ${opts.to}`);
    } catch (error) {
      const reason = (error as Error).message;
      console.error(`[email] intern certificate failed:`, reason);
      throw new ApiError(502, `Could not email the certificate: ${reason}`);
    }
  }
}

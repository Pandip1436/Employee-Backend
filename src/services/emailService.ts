import nodemailer from "nodemailer";
import CompanySettings from "../models/CompanySettings";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function getAdminEmails(): string[] {
  const emails = process.env.ADMIN_EMAILS || "";
  return emails.split(",").map((e) => e.trim()).filter(Boolean);
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
      <div style="background: ${headerColor}; padding: 20px 24px;">
        <h2 style="color: #fff; margin: 0; font-size: 18px;">${title}</h2>
      </div>
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
  const adminEmails = getAdminEmails();
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
        <div style="background: #4f46e5; padding: 20px 24px;">
          <h2 style="color: #fff; margin: 0; font-size: 18px;">Clock In Notification</h2>
        </div>
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
      totalHours: `${totalHours}h`,
    };

    const fallbackHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #4f46e5; padding: 20px 24px;">
          <h2 style="color: #fff; margin: 0; font-size: 18px;">Clock Out Notification</h2>
        </div>
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
        subject: `Clock Out: ${employeeName} — ${totalHours}h worked`,
        html: fallbackHtml,
      },
      "#4f46e5"
    );
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
        <div style="background: #dc2626; padding: 20px 24px;">
          <h2 style="color: #fff; margin: 0; font-size: 18px;">Late Login Alert</h2>
        </div>
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
}

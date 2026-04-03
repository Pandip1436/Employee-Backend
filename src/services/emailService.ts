import nodemailer from "nodemailer";

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
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export class EmailService {
  static async sendClockInNotification(employeeName: string, employeeEmail: string, clockInTime: Date) {
    const adminEmails = getAdminEmails();
    if (adminEmails.length === 0) return;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #4f46e5; padding: 20px 24px;">
          <h2 style="color: #fff; margin: 0; font-size: 18px;">Clock In Notification</h2>
        </div>
        <div style="padding: 24px;">
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <p style="margin: 0; color: #15803d; font-weight: 600;">Employee has clocked in</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Employee</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${employeeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">${employeeEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">${formatDate(clockInTime)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Clock In</td>
              <td style="padding: 8px 0; color: #22c55e; font-size: 16px; font-weight: 700;">${formatTime(clockInTime)}</td>
            </tr>
          </table>
        </div>
        <div style="background: #f9fafb; padding: 12px 24px; text-align: center;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">United Nexa Tech — Employee Portal</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"United Nexa Tech" <${process.env.SMTP_USER}>`,
        to: adminEmails.join(", "),
        subject: `Clock In: ${employeeName} — ${formatTime(clockInTime)}`,
        html,
      });
      console.log(`Clock-in email sent for ${employeeName}`);
    } catch (error) {
      console.error("Failed to send clock-in email:", (error as Error).message);
    }
  }

  static async sendClockOutNotification(
    employeeName: string,
    employeeEmail: string,
    clockInTime: Date,
    clockOutTime: Date,
    totalHours: number
  ) {
    const adminEmails = getAdminEmails();
    if (adminEmails.length === 0) return;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #4f46e5; padding: 20px 24px;">
          <h2 style="color: #fff; margin: 0; font-size: 18px;">Clock Out Notification</h2>
        </div>
        <div style="padding: 24px;">
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <p style="margin: 0; color: #dc2626; font-weight: 600;">Employee has clocked out</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Employee</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${employeeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">${employeeEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">${formatDate(clockOutTime)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Clock In</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">${formatTime(clockInTime)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Clock Out</td>
              <td style="padding: 8px 0; color: #ef4444; font-size: 16px; font-weight: 700;">${formatTime(clockOutTime)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Total Hours</td>
              <td style="padding: 8px 0; color: #4f46e5; font-size: 16px; font-weight: 700;">${totalHours}h</td>
            </tr>
          </table>
        </div>
        <div style="background: #f9fafb; padding: 12px 24px; text-align: center;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">United Nexa Tech — Employee Portal</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"United Nexa Tech" <${process.env.SMTP_USER}>`,
        to: adminEmails.join(", "),
        subject: `Clock Out: ${employeeName} — ${totalHours}h worked`,
        html,
      });
      console.log(`Clock-out email sent for ${employeeName}`);
    } catch (error) {
      console.error("Failed to send clock-out email:", (error as Error).message);
    }
  }

  static async sendLateAlertNotification(
    employeeName: string,
    employeeEmail: string,
    clockInTime: Date,
    lateByMinutes: number
  ) {
    const adminEmails = getAdminEmails();
    if (adminEmails.length === 0) return;

    const hours = Math.floor(lateByMinutes / 60);
    const mins = lateByMinutes % 60;
    const lateDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`;
    const officeTime = process.env.OFFICE_START_TIME || "09:15";

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #dc2626; padding: 20px 24px;">
          <h2 style="color: #fff; margin: 0; font-size: 18px;">Late Login Alert</h2>
        </div>
        <div style="padding: 24px;">
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <p style="margin: 0; color: #dc2626; font-weight: 600;">Employee arrived late by ${lateDuration}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 130px;">Employee</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${employeeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">${employeeEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">${formatDate(clockInTime)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Office Start</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">${officeTime} AM</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Actual Clock In</td>
              <td style="padding: 8px 0; color: #dc2626; font-size: 16px; font-weight: 700;">${formatTime(clockInTime)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Late By</td>
              <td style="padding: 8px 0; color: #dc2626; font-size: 16px; font-weight: 700;">${lateDuration}</td>
            </tr>
          </table>
        </div>
        <div style="background: #f9fafb; padding: 12px 24px; text-align: center;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">United Nexa Tech — Employee Portal</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"United Nexa Tech" <${process.env.SMTP_USER}>`,
        to: adminEmails.join(", "),
        subject: `LATE ALERT: ${employeeName} — late by ${lateDuration}`,
        html,
      });
      console.log(`Late alert email sent for ${employeeName}`);
    } catch (error) {
      console.error("Failed to send late alert email:", (error as Error).message);
    }
  }
}

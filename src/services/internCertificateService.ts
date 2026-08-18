import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import User from "../models/User";
import InternProfile from "../models/InternProfile";
import CompanySettings from "../models/CompanySettings";
import { ApiError } from "../utils/ApiError";
import { EmailService } from "./emailService";

/* ── Palette ── mirrors the teal/emerald theme the interns module uses. ── */
const INK = "#0F172A";
const BODY = "#334155";
const MUTED = "#94A3B8";
const TEAL = "#0F766E";
const TEAL_SOFT = "#99F6E4";
const GOLD = "#B08A45";

const PAGE_W = 841.89; // A4 landscape
const PAGE_H = 595.28;

export interface CertificateContext {
  internId: string;
  name: string;
  email: string;
  department?: string;
  college?: string;
  degree?: string;
  courseYear?: string;
  mentor?: string;
  startDate: string;
  endDate: string;
  durationMonths?: number;
  internshipType: string;
  companyName: string;
  certificateNo: string;
  issuedAt: string;
  alreadyIssued: boolean;
}

export interface GeneratedCertificate {
  buffer: Buffer;
  filename: string;
  context: CertificateContext;
}

/** "2026-06-01" → "01 June 2026". Term dates are stored as plain YYYY-MM-DD. */
const longDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
};

const monthsBetween = (start: string, end: string): number => {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return Math.max(1, e.getDate() >= s.getDate() ? months : months - 1);
};

/** "United Nexa Tech" → "UNT" — used for the seal monogram and the reference number. */
const initials = (companyName: string): string =>
  companyName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase())
    .join("")
    .slice(0, 4) || "UNT";

/**
 * Reference derived from the intern's id — no counter to race on, and a re-issue
 * reproduces the same number as the copy already sitting in the intern's inbox.
 */
const mintCertificateNo = (companyName: string, internId: string, issuedAt: string): string =>
  `${initials(companyName)}/INT/${issuedAt.slice(0, 4)}/${internId.slice(-6).toUpperCase()}`;

/** Optional real logo; falls back to the drawn monogram crest when absent. */
const findLogo = (): string | null => {
  const candidates = [
    process.env.CERTIFICATE_LOGO_PATH,
    path.join(process.cwd(), "assets", "certificate-logo.png"),
    path.join(__dirname, "..", "..", "assets", "certificate-logo.png"),
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* unreadable path — fall through to the drawn crest */
    }
  }
  return null;
};

export class InternCertificateService {
  /**
   * Everything the certificate prints, plus the rules for issuing one. Throws
   * with an admin-readable reason when the internship record is not ready.
   */
  static async getContext(id: string): Promise<CertificateContext> {
    const user = await User.findOne({ _id: id, role: "intern" }).select("name email department");
    if (!user) throw new ApiError(404, "Intern not found.");

    const profile = await InternProfile.findOne({ userId: user._id })
      .populate("mentorId", "name")
      .lean();
    if (!profile) throw new ApiError(400, "This intern has no internship record yet.");
    if (!profile.startDate || !profile.endDate) {
      throw new ApiError(400, "Set the internship start and end dates before generating a certificate.");
    }
    if (profile.status === "terminated") {
      throw new ApiError(400, "A completion certificate cannot be issued for a terminated internship.");
    }

    const settings = await CompanySettings.findOne().select("companyName").lean();
    const companyName = (settings as { companyName?: string } | null)?.companyName || "United Nexa Tech";

    // The issue date is minted once so re-sends keep the original wording.
    const issuedAt = profile.certificateIssuedAt || new Date().toISOString().slice(0, 10);

    return {
      internId: user._id.toString(),
      name: user.name,
      email: user.email,
      department: user.department,
      college: profile.college,
      degree: profile.degree,
      courseYear: profile.courseYear,
      mentor: (profile.mentorId as unknown as { name?: string } | null)?.name,
      startDate: profile.startDate,
      endDate: profile.endDate,
      durationMonths: profile.durationMonths,
      internshipType: profile.internshipType || "full-time",
      companyName,
      certificateNo:
        profile.certificateNo || mintCertificateNo(companyName, user._id.toString(), issuedAt),
      issuedAt,
      alreadyIssued: Boolean(profile.certificateIssued),
    };
  }

  /** Renders the certificate to a PDF buffer. Nothing is persisted here. */
  static async render(ctx: CertificateContext): Promise<GeneratedCertificate> {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: `Internship Certificate — ${ctx.name}`,
        Author: ctx.companyName,
        Subject: `Certificate ${ctx.certificateNo}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    // Every line is placed at an absolute y across the full page width, so the
    // composition stays symmetrical no matter how long the values are.
    const center = (
      text: string,
      y: number,
      opts: { font: string; size: number; color: string; spacing?: number },
    ) => {
      doc
        .font(opts.font)
        .fontSize(opts.size)
        .fillColor(opts.color)
        .text(text, 0, y, {
          width: PAGE_W,
          align: "center",
          characterSpacing: opts.spacing ?? 0,
          lineBreak: false,
        });
    };

    /* ── Frame ── */
    doc.rect(0, 0, PAGE_W, PAGE_H).fill("#FFFFFF");
    doc.lineWidth(3).strokeColor(TEAL).rect(22, 22, PAGE_W - 44, PAGE_H - 44).stroke();
    doc.lineWidth(1).strokeColor(TEAL_SOFT).rect(32, 32, PAGE_W - 64, PAGE_H - 64).stroke();

    // Gold L-brackets tucked inside each corner.
    const bracket = (x: number, y: number, dx: number, dy: number) => {
      doc.lineWidth(2).strokeColor(GOLD);
      doc.moveTo(x, y).lineTo(x + 26 * dx, y).stroke();
      doc.moveTo(x, y).lineTo(x, y + 26 * dy).stroke();
    };
    bracket(44, 44, 1, 1);
    bracket(PAGE_W - 44, 44, -1, 1);
    bracket(44, PAGE_H - 44, 1, -1);
    bracket(PAGE_W - 44, PAGE_H - 44, -1, -1);

    /* ── Crest ── */
    const logo = findLogo();
    const crestY = 62;
    let crestDrawn = false;
    if (logo) {
      try {
        doc.image(logo, PAGE_W / 2 - 26, crestY, { fit: [52, 52] });
        crestDrawn = true;
      } catch {
        /* unreadable image — fall back to the monogram below */
      }
    }
    if (!crestDrawn) {
      doc.circle(PAGE_W / 2, crestY + 26, 24).fill(TEAL);
      doc.circle(PAGE_W / 2, crestY + 26, 20).lineWidth(1).strokeColor("#FFFFFF").stroke();
      center(initials(ctx.companyName), crestY + 19, {
        font: "Helvetica-Bold",
        size: 13,
        color: "#FFFFFF",
        spacing: 1,
      });
    }

    center(ctx.companyName.toUpperCase(), 124, {
      font: "Helvetica-Bold",
      size: 12,
      color: TEAL,
      spacing: 3.4,
    });
    center("INTERNSHIP PROGRAMME", 143, {
      font: "Helvetica",
      size: 7.5,
      color: MUTED,
      spacing: 2.6,
    });

    /* ── Title ── */
    center("CERTIFICATE OF COMPLETION", 172, {
      font: "Times-Bold",
      size: 30,
      color: INK,
      spacing: 2.2,
    });

    // Divider: two rules with a small diamond between them.
    const dividerY = 218;
    doc.lineWidth(1).strokeColor(GOLD);
    doc.moveTo(PAGE_W / 2 - 130, dividerY).lineTo(PAGE_W / 2 - 12, dividerY).stroke();
    doc.moveTo(PAGE_W / 2 + 12, dividerY).lineTo(PAGE_W / 2 + 130, dividerY).stroke();
    doc
      .moveTo(PAGE_W / 2, dividerY - 5)
      .lineTo(PAGE_W / 2 + 5, dividerY)
      .lineTo(PAGE_W / 2, dividerY + 5)
      .lineTo(PAGE_W / 2 - 5, dividerY)
      .fill(GOLD);

    center("This is to certify that", 236, {
      font: "Times-Italic",
      size: 13,
      color: "#64748B",
    });

    /* ── Recipient ── */
    // A long name shrinks to stay on one line rather than wrapping into the citation.
    let nameSize = 30;
    doc.font("Times-Bold").fontSize(nameSize);
    while (doc.widthOfString(ctx.name) > 620 && nameSize > 18) {
      nameSize -= 1;
      doc.fontSize(nameSize);
    }
    center(ctx.name, 260 + (30 - nameSize) / 2, {
      font: "Times-Bold",
      size: nameSize,
      color: TEAL,
      spacing: 0.5,
    });
    doc.font("Times-Bold").fontSize(nameSize);
    const ruleW = Math.min(Math.max(doc.widthOfString(ctx.name) + 60, 220), 620);
    doc
      .lineWidth(0.8)
      .strokeColor(TEAL_SOFT)
      .moveTo((PAGE_W - ruleW) / 2, 302)
      .lineTo((PAGE_W + ruleW) / 2, 302)
      .stroke();

    /* ── Citation ── */
    const months = ctx.durationMonths ?? monthsBetween(ctx.startDate, ctx.endDate);
    const academic = [ctx.degree, ctx.courseYear].filter(Boolean).join(", ");
    const origin = ctx.college
      ? `of ${ctx.college}${academic ? ` (${academic})` : ""}, `
      : academic
        ? `${academic} student, `
        : "";
    const dept = ctx.department ? ` in the ${ctx.department} department` : "";
    const type = ctx.internshipType === "part-time" ? "part-time" : "full-time";

    const citation = [
      `${origin}has successfully completed a ${months}-month ${type} internship${dept} at ${ctx.companyName}, from ${longDate(ctx.startDate)} to ${longDate(ctx.endDate)}.`,
      ctx.mentor ? `The internship was carried out under the mentorship of ${ctx.mentor}.` : "",
      `Throughout the programme ${ctx.name} showed commendable dedication, professionalism and a genuine willingness to learn.`,
    ]
      .filter(Boolean)
      .join(" ");

    // The citation sits in a fixed band between the name rule and the footer.
    // Long college/department names get a smaller size rather than a collision,
    // and whatever the height, the block is centred inside the band.
    const CITE_W = 620;
    const CITE_TOP = 318;
    const CITE_BAND = 130;
    let citeSize = 13;
    doc.font("Times-Roman");
    let citeHeight = doc.fontSize(citeSize).heightOfString(citation, { width: CITE_W, lineGap: 5 });
    while (citeHeight > CITE_BAND && citeSize > 10.5) {
      citeSize -= 0.5;
      citeHeight = doc.fontSize(citeSize).heightOfString(citation, { width: CITE_W, lineGap: 5 });
    }
    doc
      .font("Times-Roman")
      .fontSize(citeSize)
      .fillColor(BODY)
      .text(citation, (PAGE_W - CITE_W) / 2, CITE_TOP + Math.max(0, (CITE_BAND - citeHeight) / 2), {
        width: CITE_W,
        align: "center",
        lineGap: 5,
      });

    /* ── Footer: reference on the left, signature on the right ── */
    const footY = 468;
    const left = 90;
    const metaLine = (label: string, value: string, y: number) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(MUTED)
        .text(label, left, y, { characterSpacing: 1.6, lineBreak: false });
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(INK)
        .text(value, left, y + 11, { lineBreak: false });
    };
    metaLine("CERTIFICATE NO.", ctx.certificateNo, footY);
    metaLine("DATE OF ISSUE", longDate(ctx.issuedAt), footY + 34);

    const sigRight = PAGE_W - 90;
    const sigW = 200;
    doc
      .lineWidth(0.8)
      .strokeColor("#CBD5E1")
      .moveTo(sigRight - sigW, footY + 34)
      .lineTo(sigRight, footY + 34)
      .stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(INK)
      .text("Authorised Signatory", sigRight - sigW, footY + 42, {
        width: sigW,
        align: "center",
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(ctx.companyName, sigRight - sigW, footY + 56, {
        width: sigW,
        align: "center",
        lineBreak: false,
      });

    // Seal: concentric rings with the monogram, centred between the two columns.
    const sealX = PAGE_W / 2;
    const sealY = footY + 30;
    doc.circle(sealX, sealY, 32).lineWidth(1.4).strokeColor(GOLD).stroke();
    doc.circle(sealX, sealY, 26).lineWidth(0.6).strokeColor(GOLD).stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(GOLD)
      .text(initials(ctx.companyName), sealX - 32, sealY - 12, {
        width: 64,
        align: "center",
        characterSpacing: 1,
        lineBreak: false,
      });
    doc
      .lineWidth(0.5)
      .strokeColor(GOLD)
      .moveTo(sealX - 11, sealY + 1)
      .lineTo(sealX + 11, sealY + 1)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(5.5)
      .fillColor(GOLD)
      .text("OFFICIAL SEAL", sealX - 32, sealY + 5, {
        width: 64,
        align: "center",
        characterSpacing: 0.4,
        lineBreak: false,
      });

    doc.end();

    const buffer = await done;
    const safeName = ctx.name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { buffer, filename: `Internship-Certificate-${safeName || "Intern"}.pdf`, context: ctx };
  }

  /** Build an intern's certificate without recording an issue. */
  static async generate(id: string): Promise<GeneratedCertificate> {
    const ctx = await this.getContext(id);
    return this.render(ctx);
  }

  /**
   * Emails the certificate to the intern (or an override address) and records
   * the issue on the internship profile.
   */
  static async send(
    id: string,
    opts: { email?: string; message?: string } = {},
  ): Promise<{ certificateNo: string; sentTo: string; issuedAt: string }> {
    const ctx = await this.getContext(id);
    const to = (opts.email || ctx.email || "").trim();
    if (!to) throw new ApiError(400, "No email address to send the certificate to.");

    const { buffer, filename } = await this.render(ctx);

    await EmailService.sendInternCertificate({
      to,
      internName: ctx.name,
      companyName: ctx.companyName,
      certificateNo: ctx.certificateNo,
      startDate: longDate(ctx.startDate),
      endDate: longDate(ctx.endDate),
      message: opts.message,
      attachment: { filename, content: buffer },
    });

    await InternProfile.updateOne(
      { userId: id },
      {
        $set: {
          certificateIssued: true,
          certificateNo: ctx.certificateNo,
          certificateIssuedAt: ctx.issuedAt,
          certificateSentAt: new Date(),
          certificateSentTo: to,
        },
      },
    );

    return { certificateNo: ctx.certificateNo, sentTo: to, issuedAt: ctx.issuedAt };
  }
}

import {
  BILLING_DOC_COLORS,
  FIRM_LINE,
  formatBillingPeso
} from "@/lib/billing-document-design";
import { buildClientEmailHtml, buildClientEmailPlain } from "@/lib/firm-email-signature";
import { buildFirmFormalEmailShell } from "@/lib/firm-email-shell";
import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
  sendClientEmailViaGmail,
  sentMailHint
} from "@/lib/office-tasks/gmail-send";
import {
  buildStaffSalaryComputation,
  formatStaffPayrollAccount,
  formatStaffPayrollTransferMemo,
  getStaffSalaryProfile,
  staffNameMatches,
  staffSalaryPayslipReference,
  type StaffPayPeriod,
  type StaffPayRun,
  type StaffSalaryComputeRow,
  type StaffSalaryComputeSection,
  type StaffSalaryProfile,
  type StaffSalaryReport
} from "@/lib/staff-salary";

const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Arial,Helvetica,sans-serif";
const { gold, goldLight, goldPale, cream, ink, muted, line, white, headerBg } = BILLING_DOC_COLORS;

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPayslipRowAmount(row: StaffSalaryComputeRow): string {
  if (row.amount === null) return "—";
  const value = row.amount;
  if (row.tone === "deduct" || value < 0) {
    return `−${formatBillingPeso(Math.abs(value))}`;
  }
  return formatBillingPeso(value);
}

function staffFirstName(report: StaffSalaryReport): string {
  const profile = getStaffSalaryProfile(report.staffId);
  return profile?.shortName || report.staffName.split(/\s+/)[0] || report.staffName;
}

export function staffPayRunPayslipReference(
  report: Pick<StaffSalaryReport, "staffId" | "year" | "month">,
  period: StaffPayPeriod
): string {
  return `${staffSalaryPayslipReference(report)}-${period === "mid" ? "MID" : "END"}`;
}

export function getStaffPayRunPayslipSection(
  report: StaffSalaryReport,
  period: StaffPayPeriod
): StaffSalaryComputeSection | undefined {
  const sections = buildStaffSalaryComputation(report);
  const title = period === "mid" ? "Mid-month payment" : "End-of-month payment";
  return sections.find((section) => section.title === title);
}

export function getStaffPayRunForPeriod(
  report: StaffSalaryReport,
  period: StaffPayPeriod
): StaffPayRun | undefined {
  return report.payRuns.find((run) => run.period === period);
}

export function resolveStaffEmail(
  profile: StaffSalaryProfile,
  directory: EmployeeRecord[]
): EmployeeRecord | null {
  const profileEmail = profile.email?.trim();
  if (profileEmail) {
    return {
      name: profile.displayName,
      email: profileEmail,
      role: profile.role,
      active: true
    };
  }

  const displayLower = profile.displayName.trim().toLowerCase();
  const exact = directory.find((employee) => employee.name.trim().toLowerCase() === displayLower);
  if (exact?.email.trim()) return exact;

  for (const employee of directory) {
    if (staffNameMatches(profile, employee.name) && employee.email.trim()) {
      return employee;
    }
  }

  return null;
}

export function buildStaffPayRunPayslipSubject(report: StaffSalaryReport, period: StaffPayPeriod): string {
  const run = getStaffPayRunForPeriod(report, period);
  const label = run?.label || (period === "mid" ? "Mid-month payment" : "End-of-month payment");
  return `Payslip · ${report.monthLabel} · ${label}`;
}

function resolveReportStaffEmail(
  report: StaffSalaryReport,
  directory: EmployeeRecord[]
): EmployeeRecord | null {
  const reportEmail = report.staffEmail?.trim();
  if (reportEmail) {
    return {
      name: report.staffName,
      email: reportEmail,
      role: report.role,
      active: true
    };
  }

  const profile = getStaffSalaryProfile(report.staffId);
  return profile ? resolveStaffEmail(profile, directory) : null;
}

export function buildStaffPayRunPayslipPreview(
  report: StaffSalaryReport,
  period: StaffPayPeriod,
  directory: EmployeeRecord[]
): {
  subject: string;
  html: string;
  text: string;
  recipientEmail: string | null;
  recipientName: string | null;
  recipientError: string | null;
} {
  const employee = resolveReportStaffEmail(report, directory);
  const recipientEmail = employee?.email.trim() ? normalizeEmailAddress(employee.email) : null;
  let recipientError: string | null = null;

  if (!employee) {
    recipientError = `No email for ${report.staffName}. Add their email on the Payroll roster.`;
  } else if (!recipientEmail || !isValidEmailAddress(recipientEmail)) {
    recipientError = `Invalid email on Employees sheet for ${employee.name}: ${employee.email}`;
  }

  return {
    subject: buildStaffPayRunPayslipSubject(report, period),
    html: buildStaffPayRunPayslipHtml(report, period),
    text: formatStaffPayRunPayslipText(report, period),
    recipientEmail: recipientEmail && isValidEmailAddress(recipientEmail) ? recipientEmail : null,
    recipientName: employee?.name.trim() || null,
    recipientError
  };
}

export function formatStaffPayRunPayslipText(
  report: StaffSalaryReport,
  period: StaffPayPeriod
): string {
  const section = getStaffPayRunPayslipSection(report, period);
  const run = getStaffPayRunForPeriod(report, period);
  if (!section || !run) {
    throw new Error("Pay run not found for this period.");
  }

  const lines = [
    FIRM_LINE,
    "Staff payslip",
    "",
    `Dear ${staffFirstName(report)},`,
    "",
    `Please find below your payslip for ${section.title.toLowerCase()} — ${report.monthLabel}.`,
    "This covers this pay run only.",
    "",
    `${report.staffName} · ${report.role}`,
    `Pay date · ${run.payDateLabel}${run.shiftedFromWeekend ? ` (nominal ${run.nominalDayLabel})` : ""}`,
    `Reference · ${staffPayRunPayslipReference(report, period)}`,
    `Payroll account · ${formatStaffPayrollAccount(report)}`,
    "",
    "Earnings this pay run"
  ];

  section.rows.forEach((row) => {
    const detail = row.detail ? ` · ${row.detail}` : "";
    lines.push(`${row.label}${detail} · ${formatPayslipRowAmount(row)}`);
  });

  if (run.paid) {
    lines.push("", `Payment status · Released${run.paidAt ? ` · ${run.paidAt}` : ""}`);
    if (run.transferred) {
      lines.push(
        `Bank transfer · Recorded${run.transferredAt ? ` · ${run.transferredAt}` : ""}${run.transferRef ? ` · Ref ${run.transferRef}` : ""}`
      );
    } else {
      lines.push(`Bank memo · ${formatStaffPayrollTransferMemo(report, run)}`);
    }
  }

  lines.push("", "Questions? Reply to this email or contact the office.");

  return buildClientEmailPlain(lines.join("\n"));
}

function payslipMetaCard(label: string, value: string, subvalue?: string): string {
  return (
    `<td valign="top" style="width:33.33%;padding:0 6px 0 0;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${white};border:1px solid ${goldPale};">` +
    `<tr><td style="padding:12px 14px;">` +
    `<p style="margin:0 0 6px;font-family:${SANS};font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${gold};">${escapeHtml(label)}</p>` +
    `<p style="margin:0;font-family:${SERIF};font-size:14px;line-height:1.45;color:${ink};font-weight:700;">${escapeHtml(value)}</p>` +
    (subvalue
      ? `<p style="margin:6px 0 0;font-family:${SANS};font-size:11px;line-height:1.45;color:${muted};">${escapeHtml(subvalue)}</p>`
      : "") +
    `</td></tr></table></td>`
  );
}

function renderPayslipRow(row: StaffSalaryComputeRow, index: number, totalRows: number): string {
  const isTotal = row.tone === "total";
  const isSubtotal = row.tone === "subtotal";
  const isLast = index === totalRows - 1;
  const amountColor =
    row.tone === "deduct" || (row.amount !== null && row.amount < 0) ? "#b91c1c" : isTotal ? ink : muted;
  const rowBg = isTotal ? cream : white;
  const borderBottom = isLast ? "" : `border-bottom:1px solid ${goldPale};`;
  const fontWeight = isTotal || isSubtotal ? "700" : "400";

  return (
    `<tr>` +
    `<td style="padding:${isTotal ? "14px" : "11px"} 16px;background:${rowBg};${borderBottom}">` +
    `<p style="margin:0;font-family:${SERIF};font-size:${isTotal ? "15px" : "14px"};font-weight:${fontWeight};color:${ink};">${escapeHtml(row.label)}</p>` +
    (row.detail
      ? `<p style="margin:4px 0 0;font-family:${SANS};font-size:11px;line-height:1.45;color:${muted};">${escapeHtml(row.detail)}</p>`
      : "") +
    `</td>` +
    `<td align="right" style="padding:${isTotal ? "14px" : "11px"} 16px;background:${rowBg};${borderBottom}white-space:nowrap;vertical-align:top;">` +
    `<p style="margin:0;font-family:${SERIF};font-size:${isTotal ? "20px" : "14px"};font-weight:${fontWeight};color:${amountColor};">${escapeHtml(formatPayslipRowAmount(row))}</p>` +
    `</td></tr>`
  );
}

function renderPayslipPaymentStatusBlock(report: StaffSalaryReport, run: StaffPayRun): string {
  const detailLine = run.transferred
    ? `Bank transfer${run.transferredAt ? ` · ${escapeHtml(run.transferredAt)}` : ""}${run.transferRef ? ` · Ref ${escapeHtml(run.transferRef)}` : ""}`
    : `Bank memo · ${escapeHtml(formatStaffPayrollTransferMemo(report, run))}`;

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 0;background:${white};border:1px solid ${goldPale};">` +
    `<tr><td style="height:2px;background:linear-gradient(to right, transparent, ${goldLight}, transparent);font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `<tr><td style="padding:16px 18px;background:${cream};">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">` +
    `<tr>` +
    `<td valign="top" style="width:52px;padding-right:14px;">` +
    `<div style="width:40px;height:40px;border-radius:999px;border:1px solid ${goldLight};background:${white};text-align:center;line-height:40px;font-family:${SERIF};font-size:18px;font-weight:700;color:${gold};">✓</div>` +
    `</td>` +
    `<td valign="top">` +
    `<p style="margin:0 0 6px;font-family:${SANS};font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${gold};">Payment released</p>` +
    `<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.55;color:${ink};font-weight:700;">` +
    `Recorded${run.paidAt ? ` · ${escapeHtml(run.paidAt)}` : ""}` +
    `</p>` +
    `<p style="margin:8px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${muted};">${detailLine}</p>` +
    `</td></tr></table>` +
    `</td></tr></table>`
  );
}

function payslipEmailShell(title: string, subtitle: string, innerHtml: string): string {
  return buildFirmFormalEmailShell({
    sectionLabel: title,
    documentTitle: subtitle,
    innerHtml,
    maxWidth: 580
  });
}

export function buildStaffPayRunPayslipHtml(report: StaffSalaryReport, period: StaffPayPeriod): string {
  const section = getStaffPayRunPayslipSection(report, period);
  const run = getStaffPayRunForPeriod(report, period);
  if (!section || !run) {
    throw new Error("Pay run not found for this period.");
  }

  const totalRow = section.rows.find((row) => row.tone === "total");
  const detailRows = section.rows.filter((row) => row.tone !== "total");
  const payDateSub = run.shiftedFromWeekend ? `Prior business day · nominal ${run.nominalDayLabel}` : undefined;

  const statusBlock = run.paid ? renderPayslipPaymentStatusBlock(report, run) : "";

  const inner =
    `<p style="margin:0 0 4px;font-family:${SERIF};font-size:16px;line-height:1.7;color:${ink};">Dear ${escapeHtml(staffFirstName(report))},</p>` +
    `<p style="margin:0 0 18px;font-family:${SERIF};font-size:15px;line-height:1.7;color:${ink};">Good day.</p>` +
    `<p style="margin:0 0 18px;font-family:${SERIF};font-size:14px;line-height:1.75;color:${muted};">` +
    `Please find below your payslip for <strong style="color:${ink};">${escapeHtml(section.title.toLowerCase())}</strong> — ${escapeHtml(report.monthLabel)}. ` +
    `This statement covers <strong style="color:${ink};">this pay run only</strong> and does not include other amounts due later in the month.` +
    `</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;">` +
    `<tr>` +
    payslipMetaCard("Pay date", run.payDateLabel, payDateSub) +
    payslipMetaCard("Reference", staffPayRunPayslipReference(report, period)) +
    payslipMetaCard("Payroll account", formatStaffPayrollAccount(report), report.role) +
    `</tr></table>` +
    (totalRow
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;background:${white};border:1px solid ${goldLight};">` +
        `<tr><td align="center" style="padding:20px 18px;">` +
        `<p style="margin:0 0 8px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${gold};">Amount due this pay run</p>` +
        `<p style="margin:0;font-family:${SERIF};font-size:34px;line-height:1.1;color:${ink};font-weight:700;">${escapeHtml(formatPayslipRowAmount(totalRow))}</p>` +
        `<p style="margin:10px 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${muted};">${escapeHtml(report.staffName)}</p>` +
        `</td></tr></table>`
      : "") +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid ${goldPale};background:${white};">` +
    `<tr>` +
    `<th align="left" style="padding:11px 16px;background:${headerBg};color:${white};font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Particulars</th>` +
    `<th align="right" style="padding:11px 16px;background:${headerBg};color:${white};font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Amount</th>` +
    `</tr>` +
    detailRows.map((row, index) => renderPayslipRow(row, index, detailRows.length)).join("") +
    (totalRow ? renderPayslipRow(totalRow, detailRows.length, detailRows.length + 1) : "") +
    `</table>` +
    statusBlock +
    `<p style="margin:20px 0 0;padding-top:16px;border-top:1px dashed ${line};font-family:${SERIF};font-size:13px;line-height:1.65;color:${muted};">` +
    `If anything looks off, reply to this email or contact the office.` +
    `</p>`;

  return buildClientEmailHtml(
    `<div style="font-family:${SERIF};font-size:14px;line-height:1.65;color:${ink};">` +
      payslipEmailShell("Staff payslip", `${section.title} · ${report.monthLabel}`, inner) +
      `</div>`
  );
}

export async function sendStaffPayRunPayslipEmail(input: {
  accessToken: string;
  senderEmail: string;
  report: StaffSalaryReport;
  period: StaffPayPeriod;
  directory: EmployeeRecord[];
}): Promise<{ ok: boolean; message: string; recipient?: string }> {
  const employee = resolveReportStaffEmail(input.report, input.directory);
  if (!employee) {
    return {
      ok: false,
      message: `No email for ${input.report.staffName}. Add their email on the Payroll roster.`
    };
  }

  const recipient = normalizeEmailAddress(employee.email);
  if (!recipient || !isValidEmailAddress(recipient)) {
    return {
      ok: false,
      message: `Invalid email on Employees sheet for ${employee.name}: ${employee.email}`
    };
  }

  const subject = buildStaffPayRunPayslipSubject(input.report, input.period);
  const html = buildStaffPayRunPayslipHtml(input.report, input.period);
  const text = formatStaffPayRunPayslipText(input.report, input.period);

  const delivery = await sendClientEmailViaGmail({
    accessToken: input.accessToken,
    fromEmail: normalizeEmailAddress(input.senderEmail),
    to: recipient,
    subject,
    html,
    plain: text
  });

  const run = getStaffPayRunForPeriod(input.report, input.period);
  return {
    ok: true,
    message: `Payslip emailed to ${employee.name} (${recipient})${run ? ` · ${formatBillingPeso(run.amount)}` : ""}. ${sentMailHint(delivery.senderEmail, recipient, delivery.messageId)}`,
    recipient
  };
}

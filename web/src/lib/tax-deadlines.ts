/** BIR filing tracker — confirm dates against current BIR calendar before filing */

export type TaxDeadlineGroup = "Monthly" | "Quarterly" | "Annual";

export type TaxDeadlineDef = {
  group: TaxDeadlineGroup;
  form: string;
  filing: string;
  whenToFile: string;
  notes: string;
  defaultDay?: number;
  quarterDayAfterClose?: number;
  quarterMonthDay?: "last-day-next-month";
  fixedDates?: string[];
};

export const TAX_DEADLINE_DEFS: TaxDeadlineDef[] = [
  {
    group: "Monthly",
    form: "1601-C",
    filing: "Monthly Remittance Return of Income Taxes Withheld on Compensation",
    whenToFile: "On or before the 10th day of the following month (eFPS grouping may apply).",
    defaultDay: 10,
    notes: "Verify eFPS deadline and current BIR issuances."
  },
  {
    group: "Monthly",
    form: "0619-E",
    filing: "Monthly Remittance — Creditable Withholding (Expanded)",
    whenToFile: "Often by the 10th of the following month for applicable months.",
    defaultDay: 10,
    notes: "Use with quarterly 1601-EQ reconciliation."
  },
  {
    group: "Monthly",
    form: "0619-F",
    filing: "Monthly Remittance — Final Withholding",
    whenToFile: "Often by the 10th of the following month for applicable months.",
    defaultDay: 10,
    notes: "Use with quarterly 1601-FQ reconciliation."
  },
  {
    group: "Monthly",
    form: "2550M",
    filing: "Monthly VAT Declaration",
    whenToFile: "If monthly VAT applies, commonly on or before the 20th after the month.",
    defaultDay: 20,
    notes: "Confirm whether monthly VAT applies."
  },
  {
    group: "Quarterly",
    form: "1601-EQ",
    filing: "Quarterly Remittance — Creditable Withholding (Expanded)",
    whenToFile: "Generally on or before the last day of the month following quarter close.",
    quarterMonthDay: "last-day-next-month",
    notes: "Include QAP / alphalist when applicable."
  },
  {
    group: "Quarterly",
    form: "1601-FQ",
    filing: "Quarterly Remittance — Final Withholding",
    whenToFile: "Generally on or before the last day of the month following quarter close.",
    quarterMonthDay: "last-day-next-month",
    notes: "Verify category and attachments."
  },
  {
    group: "Quarterly",
    form: "2550Q",
    filing: "Quarterly Value-Added Tax Return",
    whenToFile: "Generally on or before the 25th day following quarter close.",
    quarterDayAfterClose: 25,
    notes: "VAT-registered taxpayers."
  },
  {
    group: "Quarterly",
    form: "2551Q",
    filing: "Quarterly Percentage Tax Return",
    whenToFile: "Generally on or before the 25th day following quarter close.",
    quarterDayAfterClose: 25,
    notes: "Non-VAT taxpayers subject to percentage tax, as applicable."
  },
  {
    group: "Quarterly",
    form: "1701Q",
    filing: "Quarterly Income Tax — Individuals, Estates, Trusts",
    whenToFile: "Calendar-year tracker: May 15, August 15, November 15.",
    fixedDates: ["05-15", "08-15", "11-15"],
    notes: "Confirm taxpayer classification."
  },
  {
    group: "Quarterly",
    form: "1702Q",
    filing: "Quarterly Income Tax — Corporations / Partnerships",
    whenToFile: "Generally within 60 days after each of the first three quarter closes.",
    quarterDayAfterClose: 60,
    notes: "Fiscal-year corporations may differ."
  },
  {
    group: "Annual",
    form: "1700 / 1701 / 1701A",
    filing: "Annual Income Tax Return — Individuals",
    whenToFile: "Usually April 15 after calendar year (unless extended).",
    fixedDates: ["04-15"],
    notes: "Check current BIR extension guidance."
  },
  {
    group: "Annual",
    form: "1702-RT / 1702-EX / 1702-MX",
    filing: "Annual Income Tax Return — Corporations / Partnerships",
    whenToFile: "Generally April 15 for calendar-year corporations unless extended.",
    fixedDates: ["04-15"],
    notes: "Fiscal-year taxpayers differ."
  },
  {
    group: "Annual",
    form: "1604-C",
    filing: "Annual Information Return — Compensation Withholding",
    whenToFile: "Commonly on or before January 31 after the calendar year.",
    fixedDates: ["01-31"],
    notes: "Coordinate with Form 2316."
  },
  {
    group: "Annual",
    form: "1604-E",
    filing: "Annual Information Return — Creditable Withholding (Expanded)",
    whenToFile: "Commonly on or before March 1 after the calendar year.",
    fixedDates: ["03-01"],
    notes: "Verify alphalist requirements."
  },
  {
    group: "Annual",
    form: "2316",
    filing: "Certificate of Compensation / Tax Withheld",
    whenToFile: "Commonly issued on or before January 31 after the calendar year.",
    fixedDates: ["01-31"],
    notes: "Track issuance and submission separately if needed."
  }
];

export type TaxDeadlineView = TaxDeadlineDef & {
  index: number;
  nextDate: string;
  nextDateLabel: string;
};

function dateOnlyLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateFromMmdd(year: number, mmdd: string): Date {
  const [mm, dd] = mmdd.split("-").map(Number);
  return new Date(year, mm - 1, dd);
}

export function getNextTaxDeadlineDate(def: TaxDeadlineDef, anchor = new Date()): string | null {
  const anchorDate = dateOnlyLocal(anchor);
  const year = anchorDate.getFullYear();
  let candidates: Date[] = [];

  if (def.fixedDates) {
    [year, year + 1].forEach((y) => {
      def.fixedDates!.forEach((mmdd) => candidates.push(dateFromMmdd(y, mmdd)));
    });
  } else if (def.defaultDay) {
    for (let offset = 0; offset < 14; offset++) {
      const d = new Date(year, anchorDate.getMonth() + offset, def.defaultDay);
      candidates.push(d);
    }
  } else if (def.quarterDayAfterClose) {
    [year, year + 1].forEach((y) => {
      [2, 5, 8].forEach((quarterEndMonth) => {
        const quarterEnd = new Date(y, quarterEndMonth + 1, 0);
        const deadline = new Date(quarterEnd);
        deadline.setDate(quarterEnd.getDate() + def.quarterDayAfterClose!);
        candidates.push(deadline);
      });
    });
  } else if (def.quarterMonthDay === "last-day-next-month") {
    [year, year + 1].forEach((y) => {
      [2, 5, 8, 11].forEach((quarterEndMonth) => {
        candidates.push(new Date(y, quarterEndMonth + 2, 0));
      });
    });
  }

  candidates = candidates
    .map(dateOnlyLocal)
    .filter((d) => d.getTime() >= anchorDate.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  return candidates[0] ? formatYmd(candidates[0]) : null;
}

export function buildTaxDeadlineViews(anchor = new Date()): TaxDeadlineView[] {
  return TAX_DEADLINE_DEFS.map((def, index) => {
    const nextDate = getNextTaxDeadlineDate(def, anchor) || "";
    const nextDateLabel = nextDate
      ? new Date(nextDate + "T12:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
      : "Set manually";
    return { ...def, index, nextDate, nextDateLabel };
  });
}

export function buildTaxEventPayload(
  index: number,
  options: {
    filingDate: string;
    clientCase?: string;
    responsible?: string;
    priority?: string;
    reminderDays?: number;
    calendarSync?: boolean;
  }
) {
  const def = TAX_DEADLINE_DEFS[index];
  if (!def) throw new Error("Tax deadline not found.");

  const filingDate = options.filingDate;
  if (!filingDate) throw new Error("Choose a filing deadline date.");

  return {
    clientCase: options.clientCase?.trim() || "Tax Compliance",
    eventDate: "",
    filingDeadline: filingDate,
    category: "Deadline",
    priority: options.priority || "High",
    responsible: options.responsible || "",
    venue: "BIR / eBIRForms / eFPS",
    details: `${def.form} - ${def.filing}`,
    previousAction: "",
    nextAction:
      "Prepare, review, file, and pay if applicable. Verify deadline against the current BIR calendar.",
    remarks: `${def.whenToFile}\n${def.notes}`,
    reminderDays: options.reminderDays ?? 1,
    calendarSync: options.calendarSync === true
  };
}

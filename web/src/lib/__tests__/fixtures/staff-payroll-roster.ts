import type { StaffPayrollRosterEntry } from "@/lib/staff-payroll-roster";

export const TEST_PAYROLL_ROSTER: StaffPayrollRosterEntry[] = [
  {
    id: "hakola",
    displayName: "James Bryan Hakola",
    shortName: "JB",
    role: "Liaison Officer",
    email: "hakola@example.com",
    associatedLawyerName: "Atty. Maria Hernandez",
    associatedLawyerEmail: "maria@example.com",
    includesFieldDispatch: true,
    monthlyAllowance: 500,
    payrollBank: "BPI",
    payrollAccountNumber: "1234567890",
    active: true
  },
  {
    id: "andrea",
    displayName: "Ellyza Andrea Aguanta",
    shortName: "Andrea",
    role: "Secretary",
    email: "andrea@example.com",
    associatedLawyerName: "Atty. Maria Hernandez",
    associatedLawyerEmail: "maria@example.com",
    includesFieldDispatch: false,
    monthlyAllowance: 500,
    payrollBank: "BPI",
    payrollAccountNumber: "0987654321",
    active: true
  }
];

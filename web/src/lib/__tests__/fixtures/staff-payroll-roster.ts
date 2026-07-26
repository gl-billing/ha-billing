import type { StaffPayrollRosterEntry } from "@/lib/staff-payroll-roster";

export const TEST_PAYROLL_ROSTER: StaffPayrollRosterEntry[] = [
  {
    id: "liaison",
    displayName: "Liaison Officer",
    shortName: "Liaison",
    role: "Liaison Officer",
    email: "liaison@example.com",
    associatedLawyerName: "Atty. Robert Hernandez",
    associatedLawyerEmail: "atty.hernandez@hernandezlaw.info",
    includesFieldDispatch: true,
    monthlyAllowance: 500,
    payrollBank: "BPI",
    payrollAccountNumber: "1234567890",
    active: true
  },
  {
    id: "shiela",
    displayName: "Shiela",
    shortName: "Shiela",
    role: "Secretary",
    email: "legal@example.com",
    associatedLawyerName: "Atty. Robert Hernandez",
    associatedLawyerEmail: "atty.hernandez@hernandezlaw.info",
    includesFieldDispatch: false,
    monthlyAllowance: 500,
    payrollBank: "BPI",
    payrollAccountNumber: "0987654321",
    active: true
  }
];

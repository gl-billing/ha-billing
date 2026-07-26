import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isAdminEmail, requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import {
  getEmployeeDirectory,
  upsertEmployee
} from "@/lib/office-tasks/sheets/employees";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

/** Staff roster from the HA Employees sheet. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const accessToken = await requireSessionAccessToken();
    const includeInactive = isAdminEmail(email);
    const directory = await getEmployeeDirectory(accessToken, { includeInactive });

    return NextResponse.json({
      ok: true,
      directory,
      canEdit: isAdminEmail(email)
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not load staff roster.";
    const status = message.includes("Unauthorized") || message.includes("sign in") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

type UpsertBody = {
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
  phone?: string;
  rowNumber?: number;
};

async function handleUpsert(request: Request) {
  const session = await getServerSession(authOptions);
  requireAdminEmail(session?.user?.email);

  const accessToken = await requireSessionAccessToken();
  const body = (await request.json().catch(() => ({}))) as UpsertBody;

  const result = await upsertEmployee(accessToken, {
    name: String(body.name || ""),
    email: String(body.email || ""),
    role: body.role != null ? String(body.role) : undefined,
    active: body.active,
    phone: body.phone != null ? String(body.phone) : undefined,
    rowNumber: body.rowNumber != null ? Number(body.rowNumber) : undefined
  });

  return NextResponse.json({
    ok: true,
    created: result.created,
    employee: result.employee,
    message: result.created
      ? `Added ${result.employee.name} to the Employees sheet.`
      : `Updated ${result.employee.name} on the Employees sheet.`
  });
}

/** Add a staff row on the HA Employees sheet (admins). */
export async function POST(request: Request) {
  try {
    return await handleUpsert(request);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not add staff.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("firm admins")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Update a staff row on the HA Employees sheet (admins). */
export async function PATCH(request: Request) {
  try {
    return await handleUpsert(request);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not update staff.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("firm admins")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

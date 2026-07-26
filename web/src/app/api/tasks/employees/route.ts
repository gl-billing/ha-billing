import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";

/** Staff roster from the HA Employees sheet (read-only). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const accessToken = await requireSessionAccessToken();
    const directory = await getEmployeeDirectory(accessToken);

    return NextResponse.json({ ok: true, directory });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load staff roster.";
    const status = message.includes("Unauthorized") || message.includes("sign in") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/** HA Employees sheet is read-only in Space — upsert not ported. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Staff roster is read-only on HA. Add or edit employees directly in the Employees sheet of the tasks workbook."
    },
    { status: 501 }
  );
}

/** HA Employees sheet is read-only in Space — upsert not ported. */
export async function PATCH() {
  return NextResponse.json(
    {
      error:
        "Staff roster is read-only on HA. Add or edit employees directly in the Employees sheet of the tasks workbook."
    },
    { status: 501 }
  );
}

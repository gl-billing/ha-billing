import Link from "next/link";
import { FirmCopyright } from "@/components/FirmCopyright";

export const metadata = {
  title: "Privacy & Confidentiality · HA Billing"
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <Link href="/" className="text-xs font-bold text-gold-dark underline">
        ← Back to billing
      </Link>

      <h1 className="font-display mt-6 text-3xl font-semibold text-ink">Privacy & confidentiality</h1>
      <p className="mt-2 text-sm text-muted">Hernandez & Associates Law Office · Billing System</p>

      <div className="card mt-6 space-y-4 text-sm leading-relaxed text-ink">
        <section>
          <h2 className="font-bold text-ink">Who this applies to</h2>
          <p className="mt-1 text-muted">
            This internal billing application is for authorized staff of Hernandez &amp; Associates Law
            and Notary only. Access is restricted by Google sign-in and firm-approved email
            addresses.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-ink">What data we use</h2>
          <p className="mt-1 text-muted">
            Client names, case details, contact information, billing records, statements of account,
            and acknowledgment receipts are stored in the firm&apos;s Google Spreadsheet (your
            source of truth). PDFs may be saved to the firm&apos;s Google Drive. Email delivery
            uses the firm&apos;s Gmail account.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-ink">Confidentiality</h2>
          <p className="mt-1 text-muted">
            All client and case information is confidential and protected by attorney-client
            privilege where applicable. Do not share login access, spreadsheet links, or exported
            documents with unauthorized persons.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-ink">Your responsibilities</h2>
          <ul className="mt-1 list-inside list-disc space-y-1 text-muted">
            <li>Use your own Google account; do not share credentials.</li>
            <li>Sign out when using a shared or public device.</li>
            <li>Verify client email addresses before sending SOA or receipts.</li>
            <li>Report suspected unauthorized access to the firm immediately.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-ink">Third-party services</h2>
          <p className="mt-1 text-muted">
            This app uses Google (Sign-in, Sheets, Drive, Gmail) and may be hosted on Vercel or
            similar infrastructure. Data processing is governed by those providers&apos; terms and
            the firm&apos;s Google Workspace settings.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-ink">Questions</h2>
          <p className="mt-1 text-muted">
            Contact the firm at{" "}
            <a href="mailto:info@hernandezassociates.com" className="font-bold text-gold-dark underline">
              info@hernandezassociates.com
            </a>
            .
          </p>
        </section>
      </div>

      <FirmCopyright className="mt-6 text-center text-[10px] text-muted" />
    </div>
  );
}

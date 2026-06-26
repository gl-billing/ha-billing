import Link from "next/link";
import { FirmCopyright } from "@/components/FirmCopyright";

export const metadata = {
  title: "Terms of Use · HA Billing"
};

export default function TermsPage() {
  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <Link href="/" className="text-xs font-bold text-gold-dark underline">
        ← Back to billing
      </Link>

      <h1 className="font-display mt-6 text-3xl font-semibold text-ink">Terms of use</h1>
      <p className="mt-2 text-sm text-muted">Hernandez & Associates Law Office · Internal billing system</p>

      <div className="card mt-6 space-y-4 text-sm leading-relaxed text-ink">
        <section>
          <h2 className="font-bold">Authorized use</h2>
          <p className="mt-1 text-muted">
            This application is provided exclusively for authorized staff of Hernandez &amp; Associates
            Law Office. You must use your firm-approved Google account and comply with all
            applicable professional conduct rules.
          </p>
        </section>

        <section>
          <h2 className="font-bold">Accuracy of records</h2>
          <p className="mt-1 text-muted">
            Billing entries, client information, and document sends are your responsibility. Review
            charges, payments, and SOA/AR content before sending to clients.
          </p>
        </section>

        <section>
          <h2 className="font-bold">System availability</h2>
          <p className="mt-1 text-muted">
            The app depends on Google Sheets, Drive, Gmail, and Apps Script. Occasional rate limits
            or outages may occur. If data fails to load, wait a minute and refresh.
          </p>
        </section>

        <section>
          <h2 className="font-bold">Data ownership</h2>
          <p className="mt-1 text-muted">
            Client and billing data remain in the firm&apos;s Google Spreadsheet. The web app is a
            interface — the spreadsheet is the source of truth.
          </p>
        </section>

        <p className="text-xs text-muted">
          See also{" "}
          <Link href="/privacy" className="font-bold text-gold-dark underline">
            Privacy &amp; confidentiality
          </Link>
          .
        </p>
      </div>

      <FirmCopyright className="mt-6 text-center text-[10px] text-muted" />
    </div>
  );
}

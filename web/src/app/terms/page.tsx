import { LegalDocument } from "@/components/LegalDocument";

export const metadata = {
  title: "Terms of Use · HA Billing"
};

export default function TermsPage() {
  return (
    <LegalDocument
      kicker="Firm policy"
      title="Terms of use"
      lede="Hernandez & Associates Law Office · Internal billing system"
      related={{ href: "/privacy", label: "Privacy & confidentiality" }}
    >
      <section>
        <h2>Authorized use</h2>
        <p>
          This application is provided exclusively for authorized staff of Hernandez &amp; Associates
          Law Office. You must use your firm-approved Google account and comply with all
          applicable professional conduct rules.
        </p>
      </section>

      <section>
        <h2>Accuracy of records</h2>
        <p>
          Billing entries, client information, and document sends are your responsibility. Review
          charges, payments, and SOA/AR content before sending to clients.
        </p>
      </section>

      <section>
        <h2>System availability</h2>
        <p>
          The app depends on Google Sheets, Drive, Gmail, and Apps Script. Occasional rate limits
          or outages may occur. If data fails to load, wait a minute and refresh.
        </p>
      </section>

      <section>
        <h2>Data ownership</h2>
        <p>
          Client and billing data remain in the firm&apos;s Google Spreadsheet. The web app is a
          interface — the spreadsheet is the source of truth.
        </p>
      </section>
    </LegalDocument>
  );
}

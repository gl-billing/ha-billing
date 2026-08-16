import { LegalDocument } from "@/components/LegalDocument";

export const metadata = {
  title: "Privacy & Confidentiality · HA Billing"
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      kicker="Firm policy"
      title="Privacy & confidentiality"
      lede="Hernandez & Associates Law Office · Billing system"
      related={{ href: "/terms", label: "Terms of use" }}
    >
      <section>
        <h2>Who this applies to</h2>
        <p>
          This internal billing application is for authorized staff of Hernandez &amp; Associates Law
          and Notary only. Access is restricted by Google sign-in and firm-approved email
          addresses.
        </p>
      </section>

      <section>
        <h2>What data we use</h2>
        <p>
          Client names, case details, contact information, billing records, statements of account,
          and acknowledgment receipts are stored in the firm&apos;s Google Spreadsheet (your
          source of truth). PDFs may be saved to the firm&apos;s Google Drive. Email delivery
          uses the firm&apos;s Gmail account.
        </p>
      </section>

      <section>
        <h2>Confidentiality</h2>
        <p>
          All client and case information is confidential and protected by attorney-client
          privilege where applicable. Do not share login access, spreadsheet links, or exported
          documents with unauthorized persons.
        </p>
      </section>

      <section>
        <h2>Your responsibilities</h2>
        <ul>
          <li>Use your own Google account; do not share credentials.</li>
          <li>Sign out when using a shared or public device.</li>
          <li>Verify client email addresses before sending SOA or receipts.</li>
          <li>Report suspected unauthorized access to the firm immediately.</li>
        </ul>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          This app uses Google (Sign-in, Sheets, Drive, Gmail) and may be hosted on Vercel or
          similar infrastructure. Data processing is governed by those providers&apos; terms and
          the firm&apos;s Google Workspace settings.
        </p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          Contact the firm at{" "}
          <a href="mailto:legal@hernandezlaw.info">legal@hernandezlaw.info</a>.
        </p>
      </section>
    </LegalDocument>
  );
}

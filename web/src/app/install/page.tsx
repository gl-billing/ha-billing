import { FirmAuthShell } from "@/components/FirmAuthShell";
import { FirmPublicContactDetails } from "@/components/FirmPublicContactDetails";
import { SameWindowLink } from "@/components/SameWindowLink";

export const metadata = {
  title: "Install HA Office"
};

/** Desktop Dock / iPhone Home Screen install instructions. */
export default function InstallPage() {
  const appUrl = "https://ha-billing.vercel.app/login";

  return (
    <FirmAuthShell variant="login">
      <div className="login-page__body" style={{ textAlign: "left" }}>
        <header className="login-page__head" style={{ textAlign: "center" }}>
          <p className="login-page__eyebrow">HA Office</p>
          <p className="login-page__subtitle">Install on desktop or iPhone</p>
        </header>

        <section style={{ marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.4rem" }}>Desktop (Mac)</h2>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.55, fontSize: "0.9rem", color: "var(--muted)" }}>
            <li>
              Open{" "}
              <a href={appUrl} style={{ color: "var(--ink)", fontWeight: 600 }}>
                ha-billing.vercel.app
              </a>{" "}
              in Safari or Chrome
            </li>
            <li>Sign in with your authorized Google account</li>
            <li>
              Safari: <strong>File → Add to Dock</strong>. Chrome: install icon in the address bar
            </li>
          </ol>
        </section>

        <section style={{ marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.4rem" }}>iPhone</h2>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.55, fontSize: "0.9rem", color: "var(--muted)" }}>
            <li>
              Open the link in <strong>Safari</strong> (not Chrome)
            </li>
            <li>Sign in with your authorized Google account</li>
            <li>
              Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> → Add
            </li>
          </ol>
        </section>

        <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Use only the Google email your office authorized. Do not use a personal Gmail unless it was
          specifically approved.
        </p>

        <SameWindowLink href={appUrl} className="login-page__cta" style={{ display: "block", textAlign: "center" }}>
          Open HA Office
        </SameWindowLink>

        <div style={{ marginTop: "1.25rem" }}>
          <FirmPublicContactDetails />
        </div>
      </div>
    </FirmAuthShell>
  );
}

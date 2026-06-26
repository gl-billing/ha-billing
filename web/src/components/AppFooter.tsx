import Link from "next/link";
import { FirmCopyright } from "@/components/FirmCopyright";
import { FIRM_CONTACT } from "@/lib/firm-email-signature";

export function AppFooter() {
  return (
    <footer className="brand-footer mt-8">
      <p className="brand-footer__firm">Hernandez &amp; Associates</p>
      <p className="brand-footer__tagline">Law Office</p>
      <div className="brand-footer__rule" aria-hidden />

      <div className="brand-footer__contact">
        <span>Davao City</span>
        <a href={`mailto:${FIRM_CONTACT.email}`}>{FIRM_CONTACT.email}</a>
        <a href="tel:+638981032990">+63 898 103 2990</a>
      </div>

      <div className="brand-footer__legal">
        <Link href="/privacy">Privacy &amp; confidentiality</Link>
        <span aria-hidden>·</span>
        <Link href="/terms">Terms of use</Link>
        <span>Authorized staff only · Client data is confidential</span>
      </div>

      <FirmCopyright className="brand-footer__copyright" />
    </footer>
  );
}

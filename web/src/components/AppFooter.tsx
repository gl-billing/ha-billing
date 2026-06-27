import Link from "next/link";
import { FirmCopyright } from "@/components/FirmCopyright";
import { FIRM_CONTACT } from "@/lib/firm-email-signature";
import { firmFooterLocation, firmPhoneTelHref, firmPrimaryPhone } from "@/lib/firm-contact";

export function AppFooter() {
  const phone = firmPrimaryPhone();

  return (
    <footer className="brand-footer mt-8">
      <p className="brand-footer__firm">Hernandez &amp; Associates</p>
      <p className="brand-footer__tagline">Law Office</p>
      <div className="brand-footer__rule" aria-hidden />

      <div className="brand-footer__contact">
        <span>{firmFooterLocation()}</span>
        <a href={`mailto:${FIRM_CONTACT.email}`}>{FIRM_CONTACT.email}</a>
        {phone ? <a href={firmPhoneTelHref(phone)}>{phone}</a> : null}
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

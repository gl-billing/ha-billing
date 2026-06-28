import Link from "next/link";
import { FirmCopyright } from "@/components/FirmCopyright";
import { FirmFooterName } from "@/components/FirmFooterName";
import { FirmPublicContactDetails } from "@/components/FirmPublicContactDetails";

export function AppFooter() {
  return (
    <footer className="brand-footer mt-5">
      <FirmFooterName className="brand-footer__name" />
      <div className="brand-footer__rule" aria-hidden />

      <FirmPublicContactDetails className="brand-footer__contact" />

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

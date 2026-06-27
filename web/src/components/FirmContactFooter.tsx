import Link from "next/link";
import { FirmCopyright } from "@/components/FirmCopyright";
import { FirmPublicContactDetails } from "@/components/FirmPublicContactDetails";

/** Footer for login and portal (systems chooser) — matches billing app branding. */
export function FirmContactFooter({ guestFriendly = false }: { guestFriendly?: boolean }) {
  return (
    <div className="firm-auth-footer__inner">
      <p className="firm-auth-footer__title">Hernandez &amp; Associates</p>
      <p className="firm-auth-footer__tagline">Law Office</p>

      <FirmPublicContactDetails className="firm-auth-footer__contact" layout="inline" />

      <div className="firm-auth-footer__legal">
        <Link href="/privacy">Privacy</Link>
        <span aria-hidden>·</span>
        <Link href="/terms">Terms</Link>
        <span aria-hidden>·</span>
        <span>{guestFriendly ? "Guest preview available" : "Authorized staff only"}</span>
      </div>

      <FirmCopyright className="firm-auth-footer__copyright" />
    </div>
  );
}

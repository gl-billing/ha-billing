import Link from "next/link";
import { FirmCopyright } from "@/components/FirmCopyright";
import { FirmFooterName } from "@/components/FirmFooterName";
import { FirmPublicContactDetails } from "@/components/FirmPublicContactDetails";

/** Footer for login and portal (systems chooser) — matches billing app branding. */
export function FirmContactFooter({ guestFriendly = false }: { guestFriendly?: boolean }) {
  return (
    <div className="firm-auth-footer__inner">
      <FirmFooterName className="firm-auth-footer__name" />

      <FirmPublicContactDetails className="firm-auth-footer__contact" />

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

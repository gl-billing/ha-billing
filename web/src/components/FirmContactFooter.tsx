import Link from "next/link";
import { FirmCopyright } from "@/components/FirmCopyright";
import { FIRM_CONTACT } from "@/lib/firm-email-signature";

/** Footer for login and portal (systems chooser) — matches billing app branding. */
export function FirmContactFooter({ guestFriendly = false }: { guestFriendly?: boolean }) {
  return (
    <div className="firm-auth-footer__inner">
      <p className="firm-auth-footer__title">Hernandez &amp; Associates</p>
      <p className="firm-auth-footer__tagline">Law Office</p>

      <div className="firm-auth-footer__contact">
        <span>Davao City</span>
        <span className="firm-auth-footer__sep" aria-hidden>
          ·
        </span>
        <a href={`mailto:${FIRM_CONTACT.email}`}>{FIRM_CONTACT.email}</a>
        <span className="firm-auth-footer__sep" aria-hidden>
          ·
        </span>
        <a href="tel:+638981032990">+63 898 103 2990</a>
      </div>

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

import Link from "next/link";
import { FirmCopyright } from "@/components/FirmCopyright";
import { FIRM_CONTACT } from "@/lib/firm-email-signature";
import { firmFooterLocation, firmPhoneTelHref, firmPrimaryPhone } from "@/lib/firm-contact";

/** Footer for login and portal (systems chooser) — matches billing app branding. */
export function FirmContactFooter({ guestFriendly = false }: { guestFriendly?: boolean }) {
  const phone = firmPrimaryPhone();

  return (
    <div className="firm-auth-footer__inner">
      <p className="firm-auth-footer__title">Hernandez &amp; Associates</p>
      <p className="firm-auth-footer__tagline">Law Office</p>

      <div className="firm-auth-footer__contact">
        <span>{firmFooterLocation()}</span>
        <span className="firm-auth-footer__sep" aria-hidden>
          ·
        </span>
        <a href={`mailto:${FIRM_CONTACT.email}`}>{FIRM_CONTACT.email}</a>
        {phone ? (
          <>
            <span className="firm-auth-footer__sep" aria-hidden>
              ·
            </span>
            <a href={firmPhoneTelHref(phone)}>{phone}</a>
          </>
        ) : null}
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

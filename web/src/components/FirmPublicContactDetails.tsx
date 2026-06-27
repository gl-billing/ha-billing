import { FIRM_CONTACT } from "@/lib/firm-email-signature";
import {
  formatFirmWebsiteLabel,
  formatLetterheadFooterAddressLines,
  firmPhoneTelHref,
  firmPrimaryPhone
} from "@/lib/firm-contact";

type Props = {
  className?: string;
};

function websiteHref(website: string): string {
  const label = formatFirmWebsiteLabel(website);
  if (!label) return "";
  return /^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${label}`;
}

/** Shared firm address, email, phone, and website — compact letterhead-style footer block. */
export function FirmPublicContactDetails({ className }: Props) {
  const phone = firmPrimaryPhone();
  const addressLines = formatLetterheadFooterAddressLines();
  const website = formatFirmWebsiteLabel(FIRM_CONTACT.website);

  return (
    <div className={className}>
      {addressLines.length > 0 ? (
        <p className="firm-footer__address">
          {addressLines.map((line, index) => (
            <span key={line}>
              {index > 0 ? <br /> : null}
              {line}
            </span>
          ))}
        </p>
      ) : null}
      <p className="firm-footer__channels">
        <a href={`mailto:${FIRM_CONTACT.email}`}>{FIRM_CONTACT.email}</a>
        {phone ? (
          <>
            <span className="firm-footer__sep" aria-hidden>
              ·
            </span>
            <a href={firmPhoneTelHref(phone)}>{phone}</a>
          </>
        ) : null}
        {website ? (
          <>
            <span className="firm-footer__sep" aria-hidden>
              ·
            </span>
            <a href={websiteHref(FIRM_CONTACT.website)} target="_blank" rel="noreferrer">
              {website}
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}

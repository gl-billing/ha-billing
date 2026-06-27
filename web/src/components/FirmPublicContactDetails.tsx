import { FIRM_CONTACT } from "@/lib/firm-email-signature";
import {
  formatFirmWebsiteLabel,
  formatLetterheadFooterAddressLines,
  firmPhoneTelHref,
  firmPrimaryPhone
} from "@/lib/firm-contact";

type Props = {
  className?: string;
  /** Inline separators (portal/login) vs stacked lines (app footer). */
  layout?: "inline" | "stacked";
};

function websiteHref(website: string): string {
  const label = formatFirmWebsiteLabel(website);
  if (!label) return "";
  return /^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${label}`;
}

/** Shared firm address, email, phone, and website for app and auth footers. */
export function FirmPublicContactDetails({ className, layout = "inline" }: Props) {
  const phone = firmPrimaryPhone();
  const addressLines = formatLetterheadFooterAddressLines();
  const website = formatFirmWebsiteLabel(FIRM_CONTACT.website);

  if (layout === "stacked") {
    return (
      <div className={className}>
        {addressLines.map((line) => (
          <span key={line}>{line}</span>
        ))}
        <a href={`mailto:${FIRM_CONTACT.email}`}>{FIRM_CONTACT.email}</a>
        {phone ? <a href={firmPhoneTelHref(phone)}>{phone}</a> : null}
        {website ? (
          <a href={websiteHref(FIRM_CONTACT.website)} target="_blank" rel="noreferrer">
            {website}
          </a>
        ) : null}
      </div>
    );
  }

  const Sep = () => (
    <span className="firm-auth-footer__sep" aria-hidden>
      ·
    </span>
  );

  return (
    <div className={className}>
      <span>{addressLines.join(" · ")}</span>
      <Sep />
      <a href={`mailto:${FIRM_CONTACT.email}`}>{FIRM_CONTACT.email}</a>
      {phone ? (
        <>
          <Sep />
          <a href={firmPhoneTelHref(phone)}>{phone}</a>
        </>
      ) : null}
      {website ? (
        <>
          <Sep />
          <a href={websiteHref(FIRM_CONTACT.website)} target="_blank" rel="noreferrer">
            {website}
          </a>
        </>
      ) : null}
    </div>
  );
}

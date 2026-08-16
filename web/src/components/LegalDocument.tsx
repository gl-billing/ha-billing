import Link from "next/link";
import type { ReactNode } from "react";
import { FirmCopyright } from "@/components/FirmCopyright";
import { FIRM_NAME, FIRM_SUBTITLE } from "@/lib/billing-document-design";

type RelatedLink = {
  href: string;
  label: string;
};

type Props = {
  kicker: string;
  title: string;
  lede: string;
  children: ReactNode;
  related?: RelatedLink;
};

export function LegalDocument({ kicker, title, lede, children, related }: Props) {
  return (
    <div className="legal-doc">
      <main className="legal-doc__sheet">
        <Link href="/" className="legal-doc__back">
          Back to billing
        </Link>

        <header className="legal-doc__letterhead">
        <img
            src="/brand/logo.png"
            alt=""
            width={48}
            height={48}
            className="legal-doc__logo"
          />
          <div className="legal-doc__firm">
            <p className="legal-doc__firm-name">{FIRM_NAME}</p>
            <p className="legal-doc__firm-sub">{FIRM_SUBTITLE}</p>
          </div>
        </header>

        <div className="legal-doc__rules" aria-hidden="true" />

        <p className="legal-doc__kicker">{kicker}</p>
        <h1 className="legal-doc__title">{title}</h1>
        <p className="legal-doc__lede">{lede}</p>

        <div className="legal-doc__body">{children}</div>

        {related ? (
          <p className="legal-doc__related">
            See also <Link href={related.href}>{related.label}</Link>
          </p>
        ) : null}
      </main>

      <FirmCopyright className="legal-doc__copyright" />
    </div>
  );
}

import { firmLetterheadLogoPublicUrl } from "@/lib/firm-print-brand";

type Props = {
  documentType?: string;
  documentTitle?: string;
  documentSubtitle?: string;
  onlyPrint?: boolean;
  className?: string;
};

/** Branded letterhead — framed logo mark matching firm stationery. */
export function FirmPrintLetterhead({
  documentType,
  documentTitle,
  documentSubtitle,
  onlyPrint = false,
  className = ""
}: Props) {
  return (
    <header
      className={[
        "firm-lh",
        "firm-print-letterhead",
        onlyPrint ? "only-print" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="firm-lh__masthead" aria-hidden="true">
        <div className="firm-lh__masthead-line firm-lh__masthead-line--heavy" />
        <div className="firm-lh__masthead-line firm-lh__masthead-line--fine" />
      </div>

      <div className="firm-lh__mark">
        <img
          src={firmLetterheadLogoPublicUrl()}
          alt="Hernandez & Associates"
          className="firm-lh__logo"
        />
      </div>

      <div className="firm-lh__closing-rule" aria-hidden="true">
        <span />
      </div>

      {documentType || documentTitle || documentSubtitle ? (
        <div className="firm-print-letterhead__document">
          {documentType ? <p className="firm-print-letterhead__doc-type">{documentType}</p> : null}
          {documentTitle ? <p className="firm-print-letterhead__doc-title">{documentTitle}</p> : null}
          {documentSubtitle ? <p className="firm-print-letterhead__doc-sub">{documentSubtitle}</p> : null}
        </div>
      ) : null}
    </header>
  );
}

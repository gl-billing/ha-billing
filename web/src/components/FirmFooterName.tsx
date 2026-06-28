import { FIRM_FOOTER_NAME } from "@/lib/firm-footer-name";

/** Single-line firm name for app and auth footers. */
export function FirmFooterName({ className = "firm-footer-name" }: { className?: string }) {
  return (
    <div className={className}>
      <p className={`${className}__line`}>{FIRM_FOOTER_NAME}</p>
    </div>
  );
}

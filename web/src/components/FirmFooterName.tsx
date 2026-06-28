import {
  FIRM_FOOTER_CAPS_LINE_1,
  FIRM_FOOTER_CAPS_LINE_2,
  splitFooterCapsChars
} from "@/lib/firm-footer-name";

function EdgeAlignedLine({ text, className }: { text: string; className: string }) {
  return (
    <p className={className}>
      {splitFooterCapsChars(text).map((char, index) => (
        <span key={`${char}-${index}`}>{char === " " ? "\u00a0" : char}</span>
      ))}
    </p>
  );
}

/** Edge-aligned HERNANDEZ / & ASSOCIATES block for app and auth footers. */
export function FirmFooterName({ className = "firm-footer-name" }: { className?: string }) {
  return (
    <div className={className}>
      <EdgeAlignedLine text={FIRM_FOOTER_CAPS_LINE_1} className={`${className}__line`} />
      <EdgeAlignedLine
        text={FIRM_FOOTER_CAPS_LINE_2}
        className={`${className}__line ${className}__line--second`}
      />
    </div>
  );
}

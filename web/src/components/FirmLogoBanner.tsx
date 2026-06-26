import { firmLogoPublicUrl } from "@/lib/firm-logo-url";

/** Hernandez rectangular logo — banner is the cover image, edge to edge. */
const LOGO_WIDTH = 1200;
const LOGO_HEIGHT = 452;

export function FirmLogoBanner({
  className = "",
  priority = false
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <figure className={`firm-logo-banner firm-logo-banner--cover ${className}`.trim()}>
      <img
        src={firmLogoPublicUrl()}
        alt="Hernandez & Associates"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className="firm-logo-banner__img"
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
      />
    </figure>
  );
}

export const FIRM_LOGO_ASPECT = LOGO_WIDTH / LOGO_HEIGHT;

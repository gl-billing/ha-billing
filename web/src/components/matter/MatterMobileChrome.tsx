"use client";

import { useRef } from "react";
import { MatterBackLink } from "@/components/matter/MatterBackLink";

type Props = {
  title: string;
  fallbackHref: string;
  onPrint: () => void;
};

/** Phone-only sticky chrome: back, matter code, overflow actions. */
export function MatterMobileChrome({ title, fallbackHref, onPrint }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    detailsRef.current?.removeAttribute("open");
  }

  return (
    <header className="matter-page__mobile-chrome no-print">
      <MatterBackLink compact className="matter-page__mobile-back" fallbackHref={fallbackHref} />
      <p className="matter-page__mobile-title">{title}</p>
      <details ref={detailsRef} className="matter-page__header-more">
        <summary className="matter-page__header-more-summary" aria-label="More actions">
          <span aria-hidden="true">⋯</span>
        </summary>
        <div className="matter-page__header-more-menu" role="menu">
          <button
            type="button"
            className="btn-secondary matter-page__header-action"
            onClick={() => {
              closeMenu();
              onPrint();
            }}
          >
            Print
          </button>
        </div>
      </details>
    </header>
  );
}

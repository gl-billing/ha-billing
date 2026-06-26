"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Props = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

const TabGuideResetContext = createContext<string | number | undefined>(undefined);

export function TabPageHeader({
  children,
  resetKey
}: {
  children?: React.ReactNode;
  /** When this changes (e.g. active nav tab), info guides collapse. */
  resetKey?: string | number;
}) {
  if (!children) return null;
  return (
    <TabGuideResetContext.Provider value={resetKey}>
      <div className="tab-page-header">{children}</div>
    </TabGuideResetContext.Provider>
  );
}

export function BillingTabGuide({ title, children, className = "" }: Props) {
  const resetKey = useContext(TabGuideResetContext);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [resetKey]);

  return (
    <details
      className={`tab-info-guide ${className}`.trim()}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="tab-info-guide__trigger" aria-label={title} title={title}>
        <span className="tab-info-guide__icon" aria-hidden="true">
          i
        </span>
      </summary>
      <div className="tab-info-guide__panel">
        <div className="tab-info-guide__body">{children}</div>
      </div>
    </details>
  );
}

export function BillingTabGuideText({ children }: { children: React.ReactNode }) {
  return <p className="tab-info-guide__text">{children}</p>;
}

/** Joins items into one paragraph — use multiple BillingTabGuideText blocks to split menus/definitions. */
export function BillingTabGuideList({ items }: { items: React.ReactNode[] }) {
  return (
    <p className="tab-info-guide__text">
      {items.map((item, index) => (
        <span key={index}>
          {index > 0 ? " " : null}
          {item}
        </span>
      ))}
    </p>
  );
}

import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function MobilePageHeader({ title, subtitle, action }: Props) {
  return (
    <header className="ha-mobile-page-header">
      <div className="ha-mobile-page-header__row">
        <h1 className="ha-mobile-page-title">{title}</h1>
        {action ? <div className="ha-mobile-page-header__action">{action}</div> : null}
      </div>
      {subtitle ? <p className="ha-mobile-page-subtitle">{subtitle}</p> : null}
    </header>
  );
}

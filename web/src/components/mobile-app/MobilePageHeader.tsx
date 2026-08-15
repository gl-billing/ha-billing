type Props = {
  title: string;
  subtitle?: string;
};

export function MobilePageHeader({ title, subtitle }: Props) {
  return (
    <header className="ha-mobile-page-header">
      <h1 className="ha-mobile-page-title">{title}</h1>
      {subtitle ? <p className="ha-mobile-page-subtitle">{subtitle}</p> : null}
    </header>
  );
}

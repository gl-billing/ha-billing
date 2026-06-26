"use client";

type Props = {
  clientName: string;
  birthdayLabel: string;
  onOpen: () => void;
};

export function MatterBirthdayBanner({ clientName, birthdayLabel, onOpen }: Props) {
  return (
    <button type="button" className="matter-birthday-banner no-print" onClick={onOpen}>
      <span className="matter-birthday-banner__icon" aria-hidden>
        🎂
      </span>
      <span className="matter-birthday-banner__text">
        Today is <strong>{clientName}</strong>&apos;s birthday ({birthdayLabel}) — preview and send the
        firm&apos;s greeting
      </span>
      <span className="matter-birthday-banner__action">Open</span>
    </button>
  );
}

"use client";

type Props = {
  className?: string;
};

export function ClientBirthdayCake({ className = "" }: Props) {
  return (
    <span
      className={`client-birthday-cake ${className}`.trim()}
      title="Birthday today"
      aria-label="Birthday today"
    >
      🎂
    </span>
  );
}

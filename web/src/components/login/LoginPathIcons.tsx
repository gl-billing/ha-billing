type Props = {
  variant: "staff" | "guest";
  className?: string;
};

export function LoginPathIcon({ variant, className = "" }: Props) {
  if (variant === "staff") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
        <path
          d="M8 7V6a4 4 0 1 1 8 0v1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <rect
          x="5"
          y="7"
          width="14"
          height="13"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M9.5 12h5M9.5 15.5h3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3.5V6.5M16 3.5V6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 10.5h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M8.5 14.5h2.5M13 14.5h2.5M8.5 17.5h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

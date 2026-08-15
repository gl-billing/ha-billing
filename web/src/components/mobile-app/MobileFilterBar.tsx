import styles from "./mobile-app.module.css";

type Option<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  value: T;
  options: Array<Option<T>>;
  onChange: (id: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export function MobileFilterBar<T extends string>({
  value,
  options,
  onChange,
  disabled,
  ariaLabel
}: Props<T>) {
  return (
    <div
      className={`${styles.filters}${options.length === 2 ? ` ${styles.filtersTwo}` : ""}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          disabled={disabled}
          className={`${styles.filter}${value === option.id ? ` ${styles.filterActive}` : ""}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

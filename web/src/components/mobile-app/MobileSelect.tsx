"use client";

import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import { useNativeMobileLayout } from "@/hooks/useNativeMobileLayout";
import styles from "./mobile-select.module.css";

export type MobileSelectOption = {
  value: string;
  label: string;
  group?: string;
};

type Props = {
  id?: string;
  name?: string;
  value: string;
  options: MobileSelectOption[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  title?: string;
  ariaLabel?: string;
  ariaBusy?: boolean;
  selectRef?: Ref<HTMLSelectElement | null>;
  triggerRef?: Ref<HTMLButtonElement | null>;
  onChange: (value: string) => void;
  onOpen?: () => void;
};

export function MobileSelect({
  id,
  name,
  value,
  options,
  disabled = false,
  required = false,
  className,
  placeholder = "Select…",
  title = "Choose an option",
  ariaLabel,
  ariaBusy,
  selectRef,
  triggerRef,
  onChange,
  onOpen
}: Props) {
  const nativeMobile = useNativeMobileLayout();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);
  const selectedLabel = selected?.label || (value ? value : placeholder);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const grouped = useMemo(() => {
    const groups: Array<{ name: string; options: MobileSelectOption[] }> = [];
    for (const option of filtered) {
      const groupName = option.group || "";
      const last = groups[groups.length - 1];
      if (last && last.name === groupName) last.options.push(option);
      else groups.push({ name: groupName, options: [option] });
    }
    return groups;
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openSheet() {
    if (disabled) return;
    setQuery("");
    setOpen(true);
    onOpen?.();
  }

  if (!nativeMobile) {
    const groups = groupedFromOptions(options);
    return (
      <select
        ref={selectRef}
        id={id}
        name={name}
        className={className}
        value={value}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-busy={ariaBusy || undefined}
        onFocus={() => onOpen?.()}
        onChange={(event) => onChange(event.target.value)}
      >
        {groups.map((group) =>
          group.name ? (
            <optgroup key={group.name} label={group.name}>
              {group.options.map((option) => (
                <option key={`${group.name}:${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ) : (
            group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          )
        )}
      </select>
    );
  }

  return (
    <div className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={styles.trigger}
        disabled={disabled}
        aria-label={ariaLabel || title}
        aria-busy={ariaBusy || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={openSheet}
      >
        <span className={`${styles.value}${selected ? "" : ` ${styles.placeholder}`}`}>{selectedLabel}</span>
        <span className={styles.caret} aria-hidden />
      </button>

      {open ? (
        <ModalPortal>
          <button type="button" className={styles.backdrop} aria-label="Close" onClick={() => setOpen(false)} />
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
            <div className={styles.sheetHead}>
              <h2 className={styles.title}>{title}</h2>
              <button type="button" className={styles.close} onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {options.length > 8 ? (
              <input
                ref={searchRef}
                type="search"
                className={styles.search}
                value={query}
                placeholder="Search"
                aria-label="Search"
                onChange={(event) => setQuery(event.target.value)}
              />
            ) : null}
            <div className={styles.list} role="listbox">
              {filtered.length === 0 ? (
                <p className={styles.empty}>No matching options.</p>
              ) : (
                grouped.map((group) => (
                  <div key={group.name || "options"}>
                    {group.name ? <p className={styles.group}>{group.name}</p> : null}
                    {group.options.map((option) => {
                      const selectedOption = option.value === value;
                      return (
                        <button
                          key={`${group.name}:${option.value}`}
                          type="button"
                          role="option"
                          aria-selected={selectedOption}
                          className={`${styles.option}${selectedOption ? ` ${styles.optionSelected}` : ""}`}
                          onClick={() => {
                            onChange(option.value);
                            setOpen(false);
                          }}
                        >
                          <span className={styles.optionLabel}>{option.label}</span>
                          {selectedOption ? <span className={styles.check} aria-hidden>✓</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}

function groupedFromOptions(options: MobileSelectOption[]): Array<{ name: string; options: MobileSelectOption[] }> {
  const groups: Array<{ name: string; options: MobileSelectOption[] }> = [];
  for (const option of options) {
    const groupName = option.group || "";
    const last = groups[groups.length - 1];
    if (last && last.name === groupName) last.options.push(option);
    else groups.push({ name: groupName, options: [option] });
  }
  return groups;
}

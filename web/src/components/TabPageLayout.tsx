"use client";

import type { ReactNode } from "react";

type TabPageBodyProps = {
  children: ReactNode;
  className?: string;
};

/** Main content area below the optional info guide — consistent spacing between sections. */
export function TabPageBody({ children, className = "" }: TabPageBodyProps) {
  return <div className={`tab-page-body ${className}`.trim()}>{children}</div>;
}

type TabPickerCardProps = {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
};

/** Client / context picker at the top of billing and schedule tabs. */
export function TabPickerCard({ label, children, hint, htmlFor, className = "" }: TabPickerCardProps) {
  return (
    <section className={`tab-picker-card card ${className}`.trim()}>
      <label className="tab-picker-card__label" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="tab-picker-card__control">{children}</div>
      {hint ? <div className="tab-picker-card__hint">{hint}</div> : null}
    </section>
  );
}

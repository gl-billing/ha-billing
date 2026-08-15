import type { ReactNode } from "react";
import { SameWindowLink } from "@/components/SameWindowLink";
import styles from "./mobile-app.module.css";

type Props = {
  href?: string;
  onClick?: () => void;
  eyebrow?: string;
  badge?: string;
  badgeMuted?: boolean;
  title: string;
  subtitle?: string;
  meta?: string;
  metaAlert?: boolean;
};

export function MobileRecordCard({
  href,
  onClick,
  eyebrow,
  badge,
  badgeMuted,
  title,
  subtitle,
  meta,
  metaAlert
}: Props) {
  const inner: ReactNode = (
    <>
      <span>
        <span className={styles.cardTop}>
          {eyebrow ? <span className={styles.code}>{eyebrow}</span> : <span />}
          {badge ? (
            <span className={`${styles.badge}${badgeMuted ? ` ${styles.badgeClosed}` : ""}`}>{badge}</span>
          ) : null}
        </span>
        <span className={`${styles.name} ha-mobile-record-title`}>{title}</span>
        {subtitle ? <span className={`${styles.matter} ha-mobile-record-subtitle`}>{subtitle}</span> : null}
        {meta ? (
          <span
            className={`${styles.balance} ${metaAlert ? styles.balanceDue : ""} ${
              metaAlert ? "ha-mobile-record-meta-alert" : "ha-mobile-record-meta"
            }`}
          >
            {meta}
          </span>
        ) : null}
      </span>
      <span className={styles.chevron} aria-hidden>
        ›
      </span>
    </>
  );

  if (href) {
    return (
      <SameWindowLink href={href} className={`${styles.card} ha-mobile-record-card`}>
        {inner}
      </SameWindowLink>
    );
  }

  return (
    <button type="button" className={`${styles.card} ha-mobile-record-card`} onClick={onClick}>
      {inner}
    </button>
  );
}

import type { ReactNode } from "react";
import styles from "./mobile-app.module.css";

type Props = {
  message: string;
  action?: ReactNode;
};

export function MobileEmptyState({ message, action }: Props) {
  return (
    <div className={styles.empty}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.png" alt="" className={styles.emptyLogo} />
      <p className={styles.emptyCopy}>{message}</p>
      {action}
    </div>
  );
}

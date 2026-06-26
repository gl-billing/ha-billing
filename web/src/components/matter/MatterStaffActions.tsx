"use client";

import { SameWindowLink } from "@/components/SameWindowLink";
import type { BillingSection } from "@/lib/matter-routes";

const STAFF_ACTIONS: { id: BillingSection; title: string; description: string }[] = [
  {
    id: "add",
    title: "Add charge or payment",
    description: "Record new billing"
  },
  {
    id: "documents",
    title: "Send SOA or AR",
    description: "Statement or acknowledgment receipt"
  }
];

type Props = {
  activeSection?: BillingSection | null;
  onSelect: (section: BillingSection) => void;
  correspondenceHref?: string;
};

export function MatterStaffActions({ activeSection, onSelect, correspondenceHref }: Props) {
  return (
    <section className="matter-staff-actions no-print" aria-label="What do you need to do?">
      <p className="matter-staff-actions__heading">What do you need to do?</p>
      <div className="matter-staff-actions__grid matter-staff-actions__grid--staff">
        {STAFF_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`matter-staff-actions__card ${
              activeSection === action.id ? "matter-staff-actions__card--active" : ""
            }`}
            onClick={() => onSelect(action.id)}
          >
            <span className="matter-staff-actions__title">{action.title}</span>
            <span className="matter-staff-actions__desc">{action.description}</span>
          </button>
        ))}
        {correspondenceHref ? (
          <SameWindowLink href={correspondenceHref} className="matter-staff-actions__card">
            <span className="matter-staff-actions__title">Draft letter</span>
            <span className="matter-staff-actions__desc">Demand, proposal, reply, or request</span>
          </SameWindowLink>
        ) : null}
      </div>
    </section>
  );
}

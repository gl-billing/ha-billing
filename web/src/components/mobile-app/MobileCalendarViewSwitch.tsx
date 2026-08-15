"use client";

import { MobileFilterBar } from "@/components/mobile-app/MobileFilterBar";
import { MobilePageHeader } from "@/components/mobile-app/MobilePageHeader";
import type { SpaceCalendarView } from "@/lib/space-nav";

type CalView = Extract<SpaceCalendarView, "day" | "month">;

type Props = {
  value: CalView;
  onChange: (view: CalView) => void;
  disabled?: boolean;
};

export function MobileCalendarViewSwitch({ value, onChange, disabled }: Props) {
  return (
    <div className="ha-mobile-app">
      <MobilePageHeader title="Calendar" />
      <MobileFilterBar
        ariaLabel="Calendar view"
        value={value}
        disabled={disabled}
        onChange={onChange}
        options={[
          { id: "day", label: "Daily" },
          { id: "month", label: "Monthly" }
        ]}
      />
    </div>
  );
}

"use client";

import { MyWorkListRow } from "@/components/office-tasks/MyWorkListRow";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { officeItemKey } from "@/lib/office-tasks/schedule";
import type { ComponentProps } from "react";

type RowProps = ComponentProps<typeof MyWorkListRow>;

type Props = Omit<RowProps, "item" | "as" | "id" | "className"> & {
  item: OfficeItem | null;
  onClose: () => void;
};

/** Checklist-style details for a single selected item (home, calendar). */
export function OfficeItemDetailHost({ item, onClose, allItems = [], toggling, ...rest }: Props) {
  if (!item) return null;
  const key = officeItemKey(item);
  void onClose;
  return (
    <MyWorkListRow
      key={key}
      item={item}
      allItems={allItems}
      as="div"
      toggling={toggling}
      {...rest}
    />
  );
}

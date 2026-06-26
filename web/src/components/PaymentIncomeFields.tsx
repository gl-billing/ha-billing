"use client";

import { PAYMENT_INCOME_TYPES, type PaymentIncomeType } from "@/lib/payment-income";

type Props = {
  incomeType: PaymentIncomeType;
  onIncomeTypeChange: (value: PaymentIncomeType) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
};

export function PaymentIncomeFields({
  incomeType,
  onIncomeTypeChange,
  description,
  onDescriptionChange,
  disabled,
  hint
}: Props) {
  return (
    <>
      <label className="block text-xs font-bold text-[#4a4339]">
        Income type
        {hint ? <span className="ml-1 font-normal text-muted">· {hint}</span> : null}
        <select
          className="field mt-1"
          value={incomeType}
          disabled={disabled}
          onChange={(e) => onIncomeTypeChange(e.target.value as PaymentIncomeType)}
        >
          {PAYMENT_INCOME_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-bold text-[#4a4339]">
        Description
        <textarea
          className="field mt-1 min-h-[72px]"
          value={description}
          disabled={disabled}
          placeholder="Optional note — defaults to income type"
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </label>
    </>
  );
}

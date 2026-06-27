"use client";

import { useEffect, useState } from "react";
import { GL } from "@/lib/gl-config";
import { OpenChargePicker } from "@/components/OpenChargePicker";
import { listOpenChargesFromLedger, type OpenChargeOption } from "@/lib/open-charges";
import { PaymentIncomeFields } from "@/components/PaymentIncomeFields";
import {
  buildPaymentLedgerFields,
  inferPaymentIncomeTypeFromLedger,
  type PaymentIncomeType
} from "@/lib/payment-income";

type Props = {
  clientCode: string;
  chargeCategories: string[];
  paymentMethods: string[];
  busy?: boolean;
  initialMode?: "charge" | "payment";
  focused?: boolean;
  chargeDraft?: { category: string; description: string; amount?: string } | null;
  onChargeDraftApplied?: () => void;
  onStatus: (message: string, isError?: boolean) => void;
  onSaved: () => void;
};

function todayLocal(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function MatterInlineLedger({
  clientCode,
  chargeCategories,
  paymentMethods,
  busy,
  initialMode = "charge",
  focused = false,
  chargeDraft,
  onChargeDraftApplied,
  onStatus,
  onSaved
}: Props) {
  const [mode, setMode] = useState<"charge" | "payment">(initialMode);
  const [submitting, setSubmitting] = useState(false);
  const [chargeDate, setChargeDate] = useState(todayLocal());
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeCategory, setChargeCategory] = useState(chargeCategories[1] || GL.chargeCategories[1]);
  const [chargeDescription, setChargeDescription] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayLocal());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0] || GL.paymentMethods[0]);
  const [paymentDetails, setPaymentDetails] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [paymentIncomeType, setPaymentIncomeType] = useState<PaymentIncomeType>("Professional Fee");
  const [paymentDefaultHint, setPaymentDefaultHint] = useState("");
  const [openCharges, setOpenCharges] = useState<OpenChargeOption[]>([]);

  useEffect(() => {
    if (mode !== "payment" || !clientCode) return;
    let cancelled = false;
    void fetch(`/api/clients/${encodeURIComponent(clientCode)}/profile`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.ledger?.entries) return;
        const inferred = inferPaymentIncomeTypeFromLedger(json.ledger.entries);
        setPaymentIncomeType(inferred);
        setPaymentDefaultHint(`Suggested from latest charge · ${inferred}`);
        setOpenCharges(listOpenChargesFromLedger(json.ledger.entries));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clientCode, mode]);

  async function submit(payload: Record<string, unknown>, successMessage: string) {
    setSubmitting(true);
    try {
      const response = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save entry.");
      onStatus(result.message || successMessage);
      setChargeAmount("");
      setChargeDescription("");
      setPaymentAmount("");
      setPaymentDetails("");
      setPaymentDescription("");
      onSaved();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to save entry.", true);
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = busy || submitting;

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!chargeDraft) return;
    setMode("charge");
    if (chargeCategories.includes(chargeDraft.category)) {
      setChargeCategory(chargeDraft.category);
    } else {
      setChargeCategory(chargeCategories.find((cat) => /appearance/i.test(cat)) || chargeCategories[1] || GL.chargeCategories[1]);
    }
    setChargeDescription(chargeDraft.description);
    if (chargeDraft.amount) setChargeAmount(chargeDraft.amount);
    onChargeDraftApplied?.();
  }, [chargeDraft, chargeCategories, onChargeDraftApplied]);

  return (
    <section
      id="matter-billing-add"
      className={`card matter-billing-section matter-inline-ledger no-print scroll-mt-3 ${
        focused ? "matter-billing-section--focus" : ""
      }`}
    >
      <p className="matter-billing-section__step">Step 1</p>
      <h2 className="matter-billing-section__title">Add a charge or payment</h2>
      <p className="matter-billing-section__help mb-3">
        Record new billing for this client. Choose <strong>Charge</strong> for fees, or{" "}
        <strong>Payment</strong> when the client pays.
      </p>
      <div className="nav-tabs mb-3 !grid-cols-2">
        <button
          type="button"
          className={`nav-tab ${mode === "charge" ? "nav-tab-active" : "nav-tab-idle"}`}
          disabled={disabled}
          onClick={() => setMode("charge")}
        >
          Charge
        </button>
        <button
          type="button"
          className={`nav-tab ${mode === "payment" ? "nav-tab-active" : "nav-tab-idle"}`}
          disabled={disabled}
          onClick={() => setMode("payment")}
        >
          Payment
        </button>
      </div>

      {mode === "charge" ? (
        <div className="space-y-2">
          <div className="form-grid-pair">
            <label className="block text-xs font-bold text-[#4a4339]">
              Date
              <input type="date" className="field mt-1" value={chargeDate} disabled={disabled} onChange={(e) => setChargeDate(e.target.value)} />
            </label>
            <label className="block text-xs font-bold text-[#4a4339]">
              Amount
              <input type="number" min="0" step="0.01" className="field mt-1" value={chargeAmount} disabled={disabled} onChange={(e) => setChargeAmount(e.target.value)} />
            </label>
          </div>
          <label className="block text-xs font-bold text-[#4a4339]">
            Category
            <select className="field mt-1" value={chargeCategory} disabled={disabled} onChange={(e) => setChargeCategory(e.target.value)}>
              {chargeCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-[#4a4339]">
            Description
            <textarea className="field mt-1 min-h-[72px]" value={chargeDescription} disabled={disabled} onChange={(e) => setChargeDescription(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={disabled || !chargeAmount}
            onClick={() =>
              void submit(
                {
                  clientCode,
                  type: "charge",
                  date: chargeDate,
                  category: chargeCategory,
                  description: chargeDescription,
                  charge: Number(chargeAmount)
                },
                "Charge saved."
              )
            }
          >
            {submitting ? "Saving…" : "Save charge"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="form-grid-pair">
            <label className="block text-xs font-bold text-[#4a4339]">
              Date
              <input type="date" className="field mt-1" value={paymentDate} disabled={disabled} onChange={(e) => setPaymentDate(e.target.value)} />
            </label>
            <label className="block text-xs font-bold text-[#4a4339]">
              Amount
              <input type="number" min="0" step="0.01" className="field mt-1" value={paymentAmount} disabled={disabled} onChange={(e) => setPaymentAmount(e.target.value)} />
            </label>
          </div>
          <label className="block text-xs font-bold text-[#4a4339]">
            Method
            <select className="field mt-1" value={paymentMethod} disabled={disabled} onChange={(e) => setPaymentMethod(e.target.value)}>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-[#4a4339]">
            Reference / details
            <input className="field mt-1" value={paymentDetails} disabled={disabled} onChange={(e) => setPaymentDetails(e.target.value)} />
          </label>
          <OpenChargePicker
            charges={openCharges}
            disabled={disabled}
            onPick={(charge) => {
              setPaymentAmount(String(charge.amount));
              setPaymentIncomeType(charge.incomeType);
              setPaymentDescription(charge.description || charge.category);
              if (charge.details?.trim()) setPaymentDetails(charge.details.trim());
              setPaymentDefaultHint(`Matched open charge · ${charge.incomeType}`);
            }}
          />
          <PaymentIncomeFields
            incomeType={paymentIncomeType}
            onIncomeTypeChange={setPaymentIncomeType}
            description={paymentDescription}
            onDescriptionChange={setPaymentDescription}
            disabled={disabled}
            hint={paymentDefaultHint || undefined}
          />
          <button
            type="button"
            className="btn-primary w-full"
            disabled={disabled || !paymentAmount}
            onClick={() => {
              const paymentFields = buildPaymentLedgerFields(paymentIncomeType, paymentDescription);
              void submit(
                {
                  clientCode,
                  type: "payment",
                  date: paymentDate,
                  method: paymentMethod,
                  details: paymentDetails,
                  category: paymentFields.category,
                  description: paymentFields.description,
                  payment: Number(paymentAmount)
                },
                "Payment saved."
              );
            }}
          >
            {submitting ? "Saving…" : "Save payment"}
          </button>
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { EventSegmentedControl } from "@/components/office-tasks/EventSegmentedControl";
import {
  fieldDispatchPresetForLocation,
  isOutsideDavaoFieldDispatch,
  LETTER_BILL_TIMING_LABELS,
  LETTER_TYPE_OPTIONS,
  type LetterBillTiming
} from "@/lib/office-tasks/letter-task-utils";
import { assessLedgerBillingClientMatch } from "@/lib/ledger-billing-client-match";
import { FIELD_DISPATCH_LOCATIONS, GL } from "@/lib/gl-config";
import { todayYmd } from "@/lib/office-tasks/schedule";

type LetterCorrespondenceFieldsProps = {
  disabled?: boolean;
  billingAccess?: boolean;
  dueDate: string;
  clientCase?: string;
  billingClientCode?: string;
  pickerClientCode?: string;
  onRecipientChange?: (recipient: string) => void;
  onLetterTypeChange?: (letterType: string, letterTypeOther: string) => void;
};

export function LetterCorrespondenceFields({
  disabled = false,
  billingAccess = true,
  dueDate,
  clientCase = "",
  billingClientCode = "",
  pickerClientCode,
  onRecipientChange,
  onLetterTypeChange
}: LetterCorrespondenceFieldsProps) {
  const [letterType, setLetterType] = useState<string>(LETTER_TYPE_OPTIONS[0]);
  const [letterTypeOther, setLetterTypeOther] = useState("");
  const [recipient, setRecipient] = useState("");
  const [serveViaLiaison, setServeViaLiaison] = useState(true);
  const [serveByDate, setServeByDate] = useState(dueDate || todayYmd());
  const [serveAddress, setServeAddress] = useState("");
  const [serveLocation, setServeLocation] = useState("Davao City");
  const [advanceGiven, setAdvanceGiven] = useState("");
  const [serviceFee, setServiceFee] = useState("");
  const [servicePaid, setServicePaid] = useState(false);
  const [billThis, setBillThis] = useState(false);
  const [billAmount, setBillAmount] = useState("");
  const [billTiming, setBillTiming] = useState<LetterBillTiming>("client_billing");
  const [billPaymentMethod, setBillPaymentMethod] = useState<string>(GL.paymentMethods[0]);

  const outsideDavao = useMemo(() => isOutsideDavaoFieldDispatch(serveLocation), [serveLocation]);
  const billingMatch = useMemo(
    () =>
      billThis && billingClientCode
        ? assessLedgerBillingClientMatch({
            clientCase,
            ledgerClientCode: billingClientCode,
            pickerClientCode
          })
        : null,
    [billThis, billingClientCode, clientCase, pickerClientCode]
  );
  const billTimingOptions = useMemo(
    () =>
      (
        [
          ["client_billing", "On SOA", LETTER_BILL_TIMING_LABELS.client_billing],
          ["pay_now", "Pay now", LETTER_BILL_TIMING_LABELS.pay_now]
        ] as const
      ).map(([value, label, title]) => ({ value, label, title })),
    []
  );

  useEffect(() => {
    if (dueDate) setServeByDate(dueDate);
  }, [dueDate]);

  useEffect(() => {
    const preset = fieldDispatchPresetForLocation(serveLocation);
    setAdvanceGiven(String(preset.defaultAdvance));
    setServiceFee(String(preset.serviceFee));
  }, [serveLocation]);

  useEffect(() => {
    onRecipientChange?.(recipient);
  }, [recipient, onRecipientChange]);

  useEffect(() => {
    onLetterTypeChange?.(letterType, letterTypeOther);
  }, [letterType, letterTypeOther, onLetterTypeChange]);

  return (
    <div className="entry-form__subpanel entry-form__subpanel--letter">
      <header className="entry-form__subpanel-head">
        <p className="entry-form__subpanel-eyebrow">Letter workflow</p>
        <p className="entry-form__subpanel-hint">Linked draft + serve tasks when liaison is on</p>
      </header>

      <div className="entry-form__subpanel-body">
        <div className="entry-form__subpanel-section">
          <p className="entry-form__subpanel-section-label">Letter details</p>

          <EventSegmentedControl
            label="Letter type"
            required
            options={[...LETTER_TYPE_OPTIONS]}
            value={letterType}
            onChange={setLetterType}
            otherValue={letterTypeOther}
            onOtherChange={setLetterTypeOther}
            otherPlaceholder="e.g. Formal notice to vacate…"
            aria-label="Letter type"
          />

          <label className="form-field">
            <span className="form-field__label">
              Recipient<span className="form-field__required"> *</span>
            </span>
            <input
              className="field-input field-input--compact"
              required
              disabled={disabled}
              value={recipient}
              placeholder="Person or office receiving the letter"
              autoComplete="name"
              onChange={(e) => setRecipient(e.target.value)}
            />
          </label>

          <div className={`form-option-card ${serveViaLiaison ? "form-option-card--on" : ""}`}>
            <div className="task-checklist-option task-checklist-option--inline">
              <div className="task-checklist-option__head">
                <button
                  type="button"
                  className={`task-checklist-toggle ${serveViaLiaison ? "task-checklist-toggle--on" : ""}`}
                  role="checkbox"
                  aria-checked={serveViaLiaison}
                  aria-label="Serve via liaison"
                  disabled={disabled}
                  onClick={() => setServeViaLiaison((current) => !current)}
                />
                <div className="task-checklist-option__copy">
                  <button
                    type="button"
                    className="task-checklist-option__label"
                    disabled={disabled}
                    onClick={() => setServeViaLiaison((current) => !current)}
                  >
                    Serve via liaison
                  </button>
                  <p className="task-checklist-option__hint">Creates a linked serve task after draft is ready.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {serveViaLiaison ? (
          <div className="entry-form__subpanel-section entry-form__subpanel-section--nested">
            <p className="entry-form__subpanel-section-label">Serving</p>

            <div className="form-grid form-grid--2">
              <label className="form-field">
                <span className="form-field__label">
                  Serve by<span className="form-field__required"> *</span>
                </span>
                <input
                  type="date"
                  className="field-input field-input--compact"
                  required
                  disabled={disabled}
                  value={serveByDate}
                  onChange={(e) => setServeByDate(e.target.value)}
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">
                  Location<span className="form-field__required"> *</span>
                </span>
                <select
                  className="field-input field-input--compact"
                  required
                  disabled={disabled}
                  value={serveLocation}
                  onChange={(e) => setServeLocation(e.target.value)}
                >
                  {FIELD_DISPATCH_LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="form-field">
              <span className="form-field__label">
                Where to serve<span className="form-field__required"> *</span>
              </span>
              <input
                className="field-input field-input--compact"
                required
                disabled={disabled}
                value={serveAddress}
                placeholder="Address or office at destination"
                onChange={(e) => setServeAddress(e.target.value)}
              />
            </label>

            <div className="form-grid form-grid--2">
              <label className="form-field">
                <span className="form-field__label">Advance (₱)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  className="field-input field-input--compact"
                  disabled={disabled || !outsideDavao}
                  value={advanceGiven}
                  onChange={(e) => setAdvanceGiven(e.target.value)}
                />
              </label>
              <label className="form-field">
                <span className="form-field__label">Service fee (₱)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  className="field-input field-input--compact"
                  disabled={disabled}
                  value={serviceFee}
                  onChange={(e) => setServiceFee(e.target.value)}
                />
              </label>
            </div>

            <p className="entry-form__inline-hint">
              {outsideDavao
                ? "Outside Davao — field dispatch row created automatically."
                : "Inside Davao — serve task only."}
            </p>

            {outsideDavao ? (
              <div className={`form-option-card ${servicePaid ? "form-option-card--on" : ""}`}>
                <div className="task-checklist-option task-checklist-option--inline">
                  <div className="task-checklist-option__head">
                    <button
                      type="button"
                      className={`task-checklist-toggle ${servicePaid ? "task-checklist-toggle--on" : ""}`}
                      role="checkbox"
                      aria-checked={servicePaid}
                      aria-label="Service already paid"
                      disabled={disabled}
                      onClick={() => setServicePaid((current) => !current)}
                    />
                    <div className="task-checklist-option__copy">
                      <button
                        type="button"
                        className="task-checklist-option__label"
                        disabled={disabled}
                        onClick={() => setServicePaid((current) => !current)}
                      >
                        Service already paid
                      </button>
                      <p className="task-checklist-option__hint">
                        Marks field dispatch paid when the row is created.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {billingAccess ? (
          <div className="entry-form__subpanel-section entry-form__subpanel-section--nested">
            <div className={`form-option-card ${billThis ? "form-option-card--on" : ""}`}>
              <div className="task-checklist-option task-checklist-option--inline">
                <div className="task-checklist-option__head">
                  <button
                    type="button"
                    className={`task-checklist-toggle ${billThis ? "task-checklist-toggle--on" : ""}`}
                    role="checkbox"
                    aria-checked={billThis}
                    aria-label="Bill this letter work"
                    disabled={disabled}
                    onClick={() => setBillThis((current) => !current)}
                  />
                  <div className="task-checklist-option__copy">
                    <button
                      type="button"
                      className="task-checklist-option__label"
                      disabled={disabled}
                      onClick={() => setBillThis((current) => !current)}
                    >
                      Bill this letter work
                    </button>
                    <p className="task-checklist-option__hint">Posts a professional fee when you save.</p>
                  </div>
                </div>
              </div>
            </div>

            {billThis ? (
              <div className="entry-form__subpanel-nested-fields">
                {billingMatch?.message &&
                (billingMatch.needsConfirmation || !billingMatch.aligned) ? (
                  <p className="entry-form__inline-hint entry-form__inline-hint--warn" role="status">
                    {billingMatch.message} You will be asked to confirm before saving.
                  </p>
                ) : billingClientCode ? (
                  <p className="entry-form__inline-hint">
                    Charge or payment will post to ledger <strong>{billingClientCode}</strong>
                    {billTiming === "client_billing" ? " (adds to balance)" : " (charge + payment recorded)"}.
                  </p>
                ) : null}
                <label className="form-field">
                  <span className="form-field__label">
                    Amount (₱)<span className="form-field__required"> *</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    className="field-input field-input--compact"
                    required
                    disabled={disabled}
                    value={billAmount}
                    placeholder="Professional fee"
                    onChange={(e) => setBillAmount(e.target.value)}
                  />
                </label>

                <EventSegmentedControl
                  label="Billing"
                  required
                  options={billTimingOptions}
                  value={billTiming}
                  onChange={(value) => setBillTiming(value as LetterBillTiming)}
                  aria-label="Letter billing timing"
                />

                {billTiming === "pay_now" ? (
                  <label className="form-field">
                    <span className="form-field__label">
                      Payment method<span className="form-field__required"> *</span>
                    </span>
                    <select
                      className="field-input field-input--compact"
                      required
                      disabled={disabled}
                      value={billPaymentMethod}
                      onChange={(e) => setBillPaymentMethod(e.target.value)}
                    >
                      {GL.paymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="entry-form__inline-hint">Added to client ledger for next SOA.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Hidden submit fields — always enabled so mobile FormData stays reliable */}
      <input type="hidden" name="letterType" value={letterType} />
      <input type="hidden" name="letterTypeOther" value={letterTypeOther} />
      <input type="hidden" name="letterRecipient" value={recipient} />
      <input type="hidden" name="serveViaLiaison" value={serveViaLiaison ? "on" : "off"} />
      {serveViaLiaison ? (
        <>
          <input type="hidden" name="serveByDate" value={serveByDate} />
          <input type="hidden" name="serveLocation" value={serveLocation} />
          <input type="hidden" name="serveAddress" value={serveAddress} />
          <input type="hidden" name="letterAdvanceGiven" value={advanceGiven} />
          <input type="hidden" name="letterServiceFee" value={serviceFee} />
          <input type="hidden" name="letterServicePaid" value={servicePaid ? "on" : "off"} />
        </>
      ) : null}
      {billingAccess ? (
        <>
          <input type="hidden" name="letterBillThis" value={billThis ? "on" : "off"} />
          {billThis ? (
            <>
              <input type="hidden" name="letterBillAmount" value={billAmount} />
              <input type="hidden" name="letterBillTiming" value={billTiming} />
              <input type="hidden" name="letterBillingConfirmed" value="off" />
              {billTiming === "pay_now" ? (
                <input type="hidden" name="letterBillPaymentMethod" value={billPaymentMethod} />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

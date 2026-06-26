"use client";

import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import { ClientCasePicker, type ClientCasePickerHandle } from "@/components/office-tasks/ClientCasePicker";
import {
  EventAddScheduleEmailDialog,
  type SavedEventInfo
} from "@/components/office-tasks/EventAddScheduleEmailDialog";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import {
  buildEventFormInputFromFormData,
  computeResponsiveFilingDate,
  defaultEventResponsiblePerson,
  defaultCategoryForEventAddKind,
  defaultPtoScheduleRows,
  eventCategoriesForAddKind,
  HEARING_INCIDENT_OPTIONS,
  HEARING_PLATFORM_OPTIONS,
  HEARING_PREP_ITEMS,
  platformOptionsForEventCategory,
  isAppearanceCategory,
  isPleadingCategory,
  isScheduleConfirmationCategory,
  PTO_SESSION_PRESETS,
  shouldOfferEventFollowUpTask,
  shouldOfferEventReminderTask,
  validateEventFormInput,
  type EventAddKind,
  type ScheduleConfirmationDraft,
  type SucceedingHearingDate
} from "@/lib/office-tasks/event-form-utils";
import {
  buildFilingPrepAssignees,
  resolveAndreaAssignee,
  resolveJasAssignee
} from "@/lib/office-tasks/task-assignees";
import { parseContactEmails } from "@/lib/contact-emails";
import type { CaseOption } from "@/lib/gl-config";
import {
  canAutoSendScheduleConfirmation,
  sendScheduleConfirmation,
  validateScheduleDraftForSend
} from "@/lib/office-tasks/schedule-confirmation-client";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { EntryFormFooter } from "@/components/office-tasks/EntryFormFooter";
import { PrepChecklistEditor } from "@/components/office-tasks/PrepChecklistEditor";
import { EventAssigneeToggle, EventSegmentedControl } from "@/components/office-tasks/EventSegmentedControl";
import type { FormSaveStatus } from "@/lib/firm-status-report";
import { prepChecklistItemsForEvent } from "@/lib/office-tasks/event-prep-checklist";

type EventFormProps = {
  options: EntryFormOptions;
  employees?: string[];
  busy: boolean;
  billingAccess?: boolean;
  initialCategory?: string;
  eventKind?: EventAddKind;
  formTitle?: string;
  formSubtitle?: string;
  onSubmit: (form: HTMLFormElement, clientCase: string) => void | Promise<void>;
  onSaveEventForSchedule?: (form: HTMLFormElement, clientCase: string) => Promise<SavedEventInfo | null>;
  onScheduleEmailComplete?: (saved: SavedEventInfo) => void | Promise<void>;
  onStatus?: (message: string, isError?: boolean) => void;
};

const PERIOD_PRESETS = [5, 10, 15, 30] as const;

export function EventAddForm({
  options,
  employees = [],
  busy,
  billingAccess = true,
  initialCategory,
  eventKind,
  formTitle,
  formSubtitle,
  onSubmit,
  onSaveEventForSchedule,
  onScheduleEmailComplete,
  onStatus
}: EventFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const casePickerRef = useRef<ClientCasePickerHandle>(null);
  const venueTouched = useRef(false);
  const responsibleTouched = useRef(false);
  const selectedCaseRef = useRef<CaseOption | null>(null);
  const visibleCategories = useMemo(
    () =>
      eventKind
        ? eventCategoriesForAddKind(eventKind, options.eventCategories)
        : options.eventCategories,
    [eventKind, options.eventCategories]
  );
  const resolvedInitialCategory =
    initialCategory && visibleCategories.includes(initialCategory)
      ? initialCategory
      : eventKind
        ? defaultCategoryForEventAddKind(eventKind)
        : visibleCategories[0] || "Hearing";
  const [category, setCategory] = useState(resolvedInitialCategory);
  const [categoryOther, setCategoryOther] = useState("");
  const [venue, setVenue] = useState("");
  const [responsible, setResponsible] = useState("");
  const [platform, setPlatform] = useState("");
  const [platformOther, setPlatformOther] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [scheduleEmailOpen, setScheduleEmailOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleConfirmationDraft | null>(null);
  const [scheduleSending, setScheduleSending] = useState(false);
  const [hearingPrep, setHearingPrep] = useState<string[]>([]);
  const [customHearingPrepItems, setCustomHearingPrepItems] = useState<string[]>([]);
  const [newHearingPrepItem, setNewHearingPrepItem] = useState("");
  const [hearingIncident, setHearingIncident] = useState("");
  const [hearingIncidentOther, setHearingIncidentOther] = useState("");
  const [filingPrepSelected, setFilingPrepSelected] = useState<string[]>([]);
  const [customFilingPrepItems, setCustomFilingPrepItems] = useState<string[]>([]);
  const [newFilingPrepItem, setNewFilingPrepItem] = useState("");
  const [reminderTaskDays, setReminderTaskDays] = useState("3");
  const [prepAssignAndrea, setPrepAssignAndrea] = useState(true);
  const [prepAssignJas, setPrepAssignJas] = useState(false);
  const [fromPretrialOrder, setFromPretrialOrder] = useState(false);
  const [succeedingRows, setSucceedingRows] = useState<SucceedingHearingDate[]>([]);
  const [pleadingType, setPleadingType] = useState(options.pleadingTypes[0] || "Initiatory pleading");
  const [pleadingCaseNature, setPleadingCaseNature] = useState(
    options.pleadingCaseNatures[0] || "Civil/Administrative"
  );
  const [receivedDate, setReceivedDate] = useState(todayYmd());
  const [periodDays, setPeriodDays] = useState("15");
  const [formError, setFormError] = useState("");
  const [formStatus, setFormStatus] = useState<FormSaveStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const computedFilingDate = useMemo(() => {
    if (pleadingType !== "Responsive pleading") return "";
    return computeResponsiveFilingDate(receivedDate, Number(periodDays) || 0);
  }, [pleadingType, receivedDate, periodDays]);

  const showAppearance = isAppearanceCategory(category);
  const showPleading = isPleadingCategory(category);
  const showFollowUpTask = shouldOfferEventFollowUpTask(category);
  const showReminderTask = shouldOfferEventReminderTask(category);
  const showHearingPrep = category === "Hearing";
  const showScheduleEmailAction = isScheduleConfirmationCategory(category);
  const showPlatform = eventKind !== "filings" && !showPleading;
  const hearingPlatformOptions = useMemo(
    () => [...HEARING_PLATFORM_OPTIONS],
    []
  );
  const appearancePlatformOptions = useMemo(
    () => platformOptionsForEventCategory(category, options.platforms),
    [category, options.platforms]
  );
  const andreaPrepName = useMemo(() => resolveAndreaAssignee(employees), [employees]);
  const jasPrepName = useMemo(() => resolveJasAssignee(employees), [employees]);
  const prepAssignedTo = useMemo(
    () => buildFilingPrepAssignees({ andrea: prepAssignAndrea, jas: prepAssignJas }, employees),
    [employees, prepAssignAndrea, prepAssignJas]
  );
  const filingPrepOptions = useMemo(
    () =>
      prepChecklistItemsForEvent({
        clientCase: "",
        category,
        categoryOther,
        pleadingType,
        pleadingCaseNature,
        priority: "Medium",
        responsible: "",
        details: ""
      }),
    [category, categoryOther, pleadingType, pleadingCaseNature]
  );
  const hearingPrepSelected = useMemo(
    () => [...hearingPrep, ...customHearingPrepItems],
    [hearingPrep, customHearingPrepItems]
  );
  const filingPrepItems = useMemo(
    () => [...filingPrepSelected, ...customFilingPrepItems],
    [filingPrepSelected, customFilingPrepItems]
  );

  useEffect(() => {
    if (!showPleading || filingPrepSelected.length > 0 || !filingPrepOptions.length) return;
    setFilingPrepSelected([...filingPrepOptions]);
  }, [showPleading, filingPrepOptions, filingPrepSelected.length]);

  function buildScheduleDraft(form: HTMLFormElement): ScheduleConfirmationDraft {
    const fd = new FormData(form);
    return {
      clientCase: casePickerRef.current?.getPendingClientCaseLabel() || String(fd.get("clientCase") || ""),
      category,
      categoryOther,
      platform,
      eventDate: String(fd.get("eventDate") || ""),
      startTime: String(fd.get("startTime") || ""),
      endTime: String(fd.get("endTime") || ""),
      venue,
      details: String(fd.get("details") || ""),
      responsible
    };
  }

  function openScheduleEmailDialog() {
    if (!formRef.current) return;
    setScheduleDraft(buildScheduleDraft(formRef.current));
    setScheduleEmailOpen(true);
  }

  async function handleScheduleEmailClick() {
    if (!formRef.current || !onSaveEventForSchedule || scheduleSending) return;

    const draft = buildScheduleDraft(formRef.current);
    const draftError = validateScheduleDraftForSend(draft);
    if (draftError) {
      onStatus?.(draftError, true);
      return;
    }

    const clientError = casePickerRef.current?.validateClientSelection();
    if (clientError) {
      onStatus?.(clientError, true);
      return;
    }

    const recipientEmails = casePickerRef.current?.getContactEmails() ?? parseContactEmails(clientEmail);
    if (!canAutoSendScheduleConfirmation(recipientEmails)) {
      openScheduleEmailDialog();
      return;
    }

    setScheduleSending(true);
    onStatus?.("Saving event and sending schedule confirmation…");
    try {
      const saved = await saveEventForScheduleEmail();
      if (!saved) throw new Error("Could not save the event.");
      const result = await sendScheduleConfirmation({
        source: "Event",
        rowNumber: saved.sheetRow,
        itemId: saved.eventId,
        recipientEmails,
        createMeetLink: draft.platform === "Google Meet"
      });
      onStatus?.(result.message);
      await onScheduleEmailComplete?.(saved);
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Could not send schedule confirmation.", true);
    } finally {
      setScheduleSending(false);
    }
  }

  async function saveEventForScheduleEmail(): Promise<SavedEventInfo | null> {
    if (!onSaveEventForSchedule || !formRef.current) {
      throw new Error("Schedule confirmation is not available right now.");
    }
    const clientError = casePickerRef.current?.validateClientSelection();
    if (clientError) throw new Error(clientError);

    const clientCase = await casePickerRef.current?.resolveClientCase();
    if (!clientCase) throw new Error("Select or enter a client / case before sending.");

    const hidden = formRef.current.querySelector('input[name="clientCase"]') as HTMLInputElement | null;
    if (hidden) hidden.value = clientCase;

    return onSaveEventForSchedule(formRef.current, clientCase);
  }

  function applyCourtVenue(option: CaseOption | null) {
    if (!option?.courtPending || venueTouched.current) return;
    setVenue(option.courtPending);
  }

  function applyDefaultResponsible(nextCategory = category) {
    if (responsibleTouched.current) return;
    setResponsible(defaultEventResponsiblePerson(nextCategory, selectedCaseRef.current, employees));
  }

  function handleCaseSelect(option: CaseOption | null) {
    selectedCaseRef.current = option;
    setClientEmail(option?.email?.trim() || "");
    if (!option) return;
    applyCourtVenue(option);
    applyDefaultResponsible();
  }

  function selectCategory(next: string) {
    setCategory(next);
    if (next === "Hearing") {
      applyCourtVenue(selectedCaseRef.current);
      if (platform && !(HEARING_PLATFORM_OPTIONS as readonly string[]).includes(platform)) {
        setPlatform("");
        setPlatformOther("");
      }
    } else {
      setHearingIncident("");
      setHearingIncidentOther("");
      if (
        platform === "Court" ||
        platform === "Video conference" ||
        (HEARING_PLATFORM_OPTIONS as readonly string[]).includes(platform)
      ) {
        setPlatform("");
        setPlatformOther("");
      }
    }
    applyDefaultResponsible(next);
  }

  function syncFilingPrepSelections(nextOptions: string[]) {
    setCustomFilingPrepItems([]);
    setNewFilingPrepItem("");
    setFilingPrepSelected([...nextOptions]);
  }

  function selectPleadingType(next: string) {
    setPleadingType(next);
    const nextOptions = prepChecklistItemsForEvent({
      clientCase: "",
      category,
      categoryOther,
      pleadingType: next,
      pleadingCaseNature,
      priority: "Medium",
      responsible: "",
      details: ""
    });
    syncFilingPrepSelections(nextOptions);
  }

  function selectPleadingCaseNature(next: string) {
    setPleadingCaseNature(next);
    const nextOptions = prepChecklistItemsForEvent({
      clientCase: "",
      category,
      categoryOther,
      pleadingType,
      pleadingCaseNature: next,
      priority: "Medium",
      responsible: "",
      details: ""
    });
    syncFilingPrepSelections(nextOptions);
  }

  function togglePretrialOrder(enabled: boolean) {
    setFromPretrialOrder(enabled);
    if (enabled && succeedingRows.length === 0) {
      setSucceedingRows(defaultPtoScheduleRows());
    }
  }

  function updateSucceedingRow(index: number, patch: Partial<SucceedingHearingDate>) {
    setSucceedingRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addSucceedingRow(preset?: string) {
    setSucceedingRows((rows) => [
      ...rows,
      { eventDate: "", startTime: "", sessionLabel: preset || "" }
    ]);
  }

  function removeSucceedingRow(index: number) {
    setSucceedingRows((rows) => rows.filter((_, i) => i !== index));
  }

  const succeedingPayload = succeedingRows.filter((row) => row.eventDate.trim() && row.sessionLabel.trim());

  function toggleHearingPrep(item: string) {
    setHearingPrep((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item]
    );
  }

  function addCustomHearingPrepItem() {
    const item = newHearingPrepItem.trim();
    if (!item || hearingPrepSelected.includes(item)) return;
    setCustomHearingPrepItems((current) => [...current, item]);
    setNewHearingPrepItem("");
  }

  function removeCustomHearingPrepItem(index: number) {
    setCustomHearingPrepItems((current) => current.filter((_, i) => i !== index));
  }

  function toggleFilingPrep(item: string) {
    setFilingPrepSelected((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item]
    );
  }

  function addCustomFilingPrepItem() {
    const item = newFilingPrepItem.trim();
    if (!item || filingPrepItems.includes(item)) return;
    setCustomFilingPrepItems((current) => [...current, item]);
    setNewFilingPrepItem("");
  }

  function removeCustomFilingPrepItem(index: number) {
    setCustomFilingPrepItems((current) => current.filter((_, i) => i !== index));
  }

  function reportError(message: string) {
    setFormError(message);
    setFormStatus({ phase: "error", message });
    onStatus?.(message, true);
  }

  async function handleSubmit(form: HTMLFormElement) {
    setFormError("");
    setFormStatus({ phase: "processing", message: "Saving event to spreadsheet…" });
    setSubmitting(true);
    try {
      const clientError = casePickerRef.current?.validateClientSelection();
      if (clientError) {
        reportError(clientError);
        return;
      }

      const fd = new FormData(form);
      const tentativeClientCase = casePickerRef.current?.getPendingClientCaseLabel() || "";
      const payload = buildEventFormInputFromFormData(fd);
      const validationError = validateEventFormInput(
        { ...payload, clientCase: tentativeClientCase || payload.clientCase },
        { requireClientCase: false }
      );
      if (validationError) {
        reportError(validationError);
        return;
      }

      const clientCase = await casePickerRef.current?.resolveClientCase();
      if (!clientCase) {
        reportError("Select or enter a client / case before saving.");
        return;
      }
      const hidden = form.querySelector('input[name="clientCase"]') as HTMLInputElement | null;
      if (hidden) hidden.value = clientCase;
      await onSubmit(form, clientCase);
      setFormStatus(null);
    } catch (error) {
      reportError(error instanceof Error ? error.message : "Could not save client / case.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      className="entry-form entry-form--event"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit(e.currentTarget);
      }}
    >
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="pleadingType" value={showPleading ? pleadingType : ""} />
      <input type="hidden" name="pleadingCaseNature" value={showPleading ? pleadingCaseNature : ""} />
      <input
        type="hidden"
        name="receivedDate"
        value={showPleading && pleadingType === "Responsive pleading" ? receivedDate : ""}
      />
      <input
        type="hidden"
        name="periodToFileDays"
        value={showPleading && pleadingType === "Responsive pleading" ? periodDays : ""}
      />
      <input type="hidden" name="filingDate" value={computedFilingDate} />
      {fromPretrialOrder ? <input type="hidden" name="fromPretrialOrder" value="1" /> : null}
      <input type="hidden" name="succeedingHearingDates" value={JSON.stringify(succeedingPayload)} />

      <EntryFormHero
        variant="event"
        eyebrow="Hearings & Events"
        title={formTitle || "Add event"}
        subtitle={
          formSubtitle ||
          "Pick the case and event type first, then fill in schedule, details, and reminders."
        }
      />

      <div className="entry-form__body">
        <EntryFormSection step={1} title="Case" hint="Which client matter does this event belong to?">
          <ClientCasePicker
            ref={casePickerRef}
            required
            highlight
            sortByClientCode
            autoFocusOnMount
            compactContactLayout
            billingAccess={billingAccess}
            submitActionLabel="Add event"
            onStatus={onStatus}
            onCaseSelect={handleCaseSelect}
          />
        </EntryFormSection>

        <EntryFormSection
          step={2}
          title="Event type & assignment"
          hint="What kind of event is this, and who is handling it?"
        >
          <div className="event-form-stack">
            <EventSegmentedControl
              label="Event type"
              required
              options={visibleCategories}
              value={category}
              onChange={selectCategory}
              otherValue={categoryOther}
              onOtherChange={setCategoryOther}
              otherPlaceholder="Specify event type…"
              aria-label="Event type"
            />

            <div className={`form-grid ${showHearingPrep ? "form-grid--3" : "form-grid--2"}`}>
              <EntrySelect label="Status" name="status" options={options.eventCreateStatuses} />
              <EntrySelect label="Priority" name="priority" options={options.priorities} />
              {showHearingPrep ? (
                <label className="form-field">
                  <span className="form-field__label">Incident</span>
                  <select
                    name="hearingIncident"
                    className="field-input"
                    value={hearingIncident}
                    onChange={(e) => {
                      setHearingIncident(e.target.value);
                      if (e.target.value !== "Other") setHearingIncidentOther("");
                    }}
                  >
                    <option value="">Select incident…</option>
                    {HEARING_INCIDENT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            {showHearingPrep && hearingIncident === "Other" ? (
              <label className="form-field">
                <span className="form-field__label">
                  Specify incident<span className="form-field__required"> *</span>
                </span>
                <input
                  name="hearingIncidentOther"
                  className="field-input"
                  value={hearingIncidentOther}
                  required
                  placeholder="Describe the hearing stage…"
                  onChange={(e) => setHearingIncidentOther(e.target.value)}
                />
              </label>
            ) : null}

            <div className="event-form-divider" aria-hidden />

            <label className="form-field">
              <span className="form-field__label">
                Responsible<span className="form-field__required"> *</span>
              </span>
              <input
                name="responsible"
                className="field-input"
                list="employees"
                required
                value={responsible}
                placeholder="Case attorney or staff in charge of this filing"
                onChange={(e) => {
                  responsibleTouched.current = true;
                  setResponsible(e.target.value);
                }}
              />
              {showPleading ? (
                <span className="form-field__hint">Usually the handling lawyer — prep work is assigned separately below.</span>
              ) : null}
            </label>
            <div className={showPlatform && !showHearingPrep ? "form-grid form-grid--2" : ""}>
              <label className="form-field">
                <span className="form-field__label">Venue</span>
                <input
                  name="venue"
                  className="field-input"
                  value={venue}
                  placeholder="Court branch, office room, address…"
                  onChange={(e) => {
                    venueTouched.current = true;
                    setVenue(e.target.value);
                  }}
                />
              </label>
              {showPlatform && !showHearingPrep ? (
                <EntrySelect
                  label="Platform"
                  name="platform"
                  options={appearancePlatformOptions}
                  value={platform}
                  onValueChange={setPlatform}
                  allowBlank
                  blankLabel="Select platform…"
                />
              ) : null}
            </div>
            {showPlatform && showHearingPrep ? (
              <>
                <input type="hidden" name="platform" value={platform} />
                <EventSegmentedControl
                  label="Platform"
                  options={hearingPlatformOptions}
                  value={platform}
                  onChange={(value) => {
                    setPlatform(value);
                    if (value !== "Other") setPlatformOther("");
                  }}
                  otherValue={platformOther}
                  onOtherChange={setPlatformOther}
                  otherInputName="platformOther"
                  otherPlaceholder="Specify platform…"
                  aria-label="Hearing platform"
                />
              </>
            ) : null}
          </div>
          {showScheduleEmailAction && onSaveEventForSchedule ? (
            <div className="schedule-email-cta">
              <div className="schedule-email-cta__copy">
                <p className="schedule-email-cta__eyebrow">Client correspondence</p>
                <p className="schedule-email-cta__title">Schedule confirmation email</p>
                <p className="schedule-email-cta__text">
                  Sends a confirmation immediately when the client email is on file. Google Meet links are created
                  automatically for online consultations.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary schedule-email-cta__btn"
                disabled={submitting || scheduleSending}
                onClick={() => void handleScheduleEmailClick()}
              >
                {scheduleSending ? "Sending…" : "Send schedule confirmation"}
              </button>
            </div>
          ) : null}
        </EntryFormSection>

        <EntryFormSection
          step={3}
          title="Event details"
          hint={
            showAppearance
              ? "Appearance date, time, and session details"
              : showPleading
                ? "Filing deadline, mode, and pleading type"
                : "Dates and specifics for this event"
          }
        >
          <div className="event-form-stack">
            {showAppearance ? (
              <>
                {showHearingPrep ? (
                  <label className="form-check form-check--flat">
                    <input
                      type="checkbox"
                      checked={fromPretrialOrder}
                      onChange={(e) => togglePretrialOrder(e.target.checked)}
                    />
                    <span className="form-check__copy">
                      <span className="form-check__text">Pre-trial order — court set succeeding dates</span>
                      <span className="form-check__hint">
                        After pre-trial, enter all hearing/trial dates from the PTO in one go. Each date becomes its own
                        hearing event on the calendar.
                      </span>
                    </span>
                  </label>
                ) : null}

                {showHearingPrep && fromPretrialOrder ? (
                  <div className="pto-schedule mt-3 space-y-3">
                    <EntryField
                      label="Pre-trial order date"
                      name="ptoOrderDate"
                      type="date"
                      optional
                      placeholder="Date the PTO was issued"
                    />
                    <div className="pto-schedule__table-wrap">
                      <table className="pto-schedule__table">
                        <thead>
                          <tr>
                            <th>Session</th>
                            <th>Date *</th>
                            <th>Time</th>
                            <th aria-label="Remove" />
                          </tr>
                        </thead>
                        <tbody>
                          {succeedingRows.map((row, index) => (
                            <tr key={`${index}-${row.sessionLabel}`}>
                              <td>
                                <input
                                  className="field-input"
                                  list="pto-sessions"
                                  value={row.sessionLabel}
                                  placeholder="e.g. Presentation of evidence"
                                  onChange={(e) => updateSucceedingRow(index, { sessionLabel: e.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  className="field-input"
                                  value={row.eventDate}
                                  onChange={(e) => updateSucceedingRow(index, { eventDate: e.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  type="time"
                                  className="field-input"
                                  value={row.startTime || ""}
                                  onChange={(e) => updateSucceedingRow(index, { startTime: e.target.value })}
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  disabled={succeedingRows.length <= 1}
                                  onClick={() => removeSucceedingRow(index)}
                                  aria-label="Remove row"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <datalist id="pto-sessions">
                      {PTO_SESSION_PRESETS.map((preset) => (
                        <option key={preset} value={preset} />
                      ))}
                    </datalist>
                    <div className="pto-schedule__actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => addSucceedingRow()}>
                        + Add date
                      </button>
                      <div className="pto-schedule__presets">
                        {PTO_SESSION_PRESETS.slice(0, 4).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => addSucceedingRow(preset)}
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="entry-form__inline-hint">
                      Agenda below applies to all sessions (e.g. case stage, witness list, notes from the PTO).
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="form-grid form-grid--2">
                      <EntryField label="Hearing / appearance date *" name="eventDate" type="date" required />
                      <EntryField label="End time" name="endTime" type="time" optional />
                    </div>
                    <div className="form-grid form-grid--2">
                      <EntryField label="Hearing / start time" name="startTime" type="time" optional />
                      <EntryField
                        label="Session notes"
                        name="sessionNotes"
                        placeholder="Branch, sala, judge, appearing counsel…"
                        optional
                      />
                    </div>
                  </>
                )}
                <p className="entry-form__inline-hint">
                  {showPlatform
                    ? showHearingPrep
                      ? "Use venue above for court branch or sala. Platform is Court, video conference, or other as set above."
                      : "Use venue and platform above for court branch, Zoom link, or phone conference details."
                    : "Use venue above for court branch, registry, or filing office."}
                </p>
                {showHearingPrep ? (
                  <details className="event-optional-panel" open>
                    <summary className="event-optional-panel__summary">Hearing prep checklist (optional)</summary>
                    <div className="event-optional-panel__body">
                      <PrepChecklistEditor
                        label="Checklist items"
                        hint="Tick items to track on the event card after saving. Add custom items as needed."
                        standardOptions={HEARING_PREP_ITEMS}
                        selectedItems={hearingPrepSelected}
                        onToggleStandard={toggleHearingPrep}
                        customItems={customHearingPrepItems}
                        newItem={newHearingPrepItem}
                        onNewItemChange={setNewHearingPrepItem}
                        onAddCustom={addCustomHearingPrepItem}
                        onRemoveCustom={removeCustomHearingPrepItem}
                        hiddenInputName="hearingPrep"
                        disabled={submitting}
                      />
                    </div>
                  </details>
                ) : null}
              </>
            ) : null}

            {showPleading ? (
              <>
                <div className="form-grid form-grid--2">
                  <EntrySelect
                    label="Pleading type *"
                    name="pleadingTypeDisplay"
                    options={options.pleadingTypes}
                    value={pleadingType}
                    onValueChange={selectPleadingType}
                  />
                  <EntrySelect
                    label="Case nature *"
                    name="pleadingCaseNatureDisplay"
                    options={options.pleadingCaseNatures}
                    value={pleadingCaseNature}
                    onValueChange={selectPleadingCaseNature}
                  />
                </div>
                <div className="form-grid form-grid--2">
                  <EntrySelect label="Filing mode *" name="filingMode" options={options.filingModes} />
                </div>

                {pleadingType === "Initiatory pleading" ? (
                  <>
                    <EntryField label="Due date *" name="filingDeadline" type="date" required />
                    <p className="entry-form__inline-hint">
                      For complaints, petitions, and other initiatory pleadings. Filing date stays blank until actually filed.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="form-grid form-grid--2">
                      <label className="form-field">
                        <span className="form-field__label">Date received *</span>
                        <input
                          type="date"
                          className="field-input"
                          value={receivedDate}
                          onChange={(e) => setReceivedDate(e.target.value)}
                          required
                        />
                      </label>
                      <label className="form-field">
                        <span className="form-field__label">Period to file (days) *</span>
                        <input
                          type="number"
                          className="field-input"
                          min={1}
                          value={periodDays}
                          onChange={(e) => setPeriodDays(e.target.value)}
                          required
                        />
                      </label>
                    </div>
                    <EventSegmentedControl
                      label="Quick period"
                      compact
                      options={PERIOD_PRESETS.map((days) => `${days} days`)}
                      value={`${periodDays} days`}
                      onChange={(label) => setPeriodDays(label.replace(/\s*days$/, ""))}
                      aria-label="Quick period to file"
                    />
                    <div className="event-computed-date">
                      <span className="event-computed-date__label">Computed filing deadline</span>
                      <strong>{computedFilingDate || "Enter received date and period"}</strong>
                    </div>
                    <input type="hidden" name="filingDeadline" value={computedFilingDate} />
                    <p className="entry-form__inline-hint">
                      For answers, motions, comments, and replies. Deadline is counted from the date received.
                    </p>
                  </>
                )}
                <details className="event-optional-panel" open>
                  <summary className="event-optional-panel__summary">Filing prep checklist</summary>
                  <div className="event-optional-panel__body">
                    <PrepChecklistEditor
                      label="Checklist items"
                      hint="Suggested items for this pleading type — adjust selections or add your own."
                      standardOptions={filingPrepOptions}
                      selectedItems={filingPrepItems}
                      onToggleStandard={toggleFilingPrep}
                      customItems={customFilingPrepItems}
                      newItem={newFilingPrepItem}
                      onNewItemChange={setNewFilingPrepItem}
                      onAddCustom={addCustomFilingPrepItem}
                      onRemoveCustom={removeCustomFilingPrepItem}
                      hiddenInputName="filingPrep"
                      disabled={submitting || busy}
                    />
                  </div>
                </details>
              </>
            ) : null}

            {!showAppearance && !showPleading ? (
              <div className="form-grid form-grid--2">
                <EntryField label="Event date" name="eventDate" type="date" />
                <EntryField label="Due / deadline" name="filingDeadline" type="date" />
              </div>
            ) : null}

            {showFollowUpTask ? (
              <p className="entry-form__inline-hint mt-3">
                On the filing deadline, a <strong>confirm if filed</strong> banner appears on this event — no extra task is
                created unless you turn on optional follow-up tasks below.
              </p>
            ) : null}
            {showFollowUpTask ? (
              <details className="event-optional-panel">
                <summary className="event-optional-panel__summary">Prep &amp; follow-up tasks</summary>
                <div className="event-optional-panel__body space-y-3">
                  <label className="form-check form-check--flat">
                    <input name="createFollowUpTask" type="checkbox" />
                    <span className="form-check__copy">
                      <span className="form-check__text">Create follow-up task on filing deadline</span>
                    </span>
                  </label>
                  <label className="form-check form-check--flat">
                    <input name="createReminderTask" type="checkbox" defaultChecked />
                    <span className="form-check__copy">
                      <span className="form-check__text">Create prep reminder task before deadline</span>
                      <span className="form-check__hint">
                        Due{" "}
                        <input
                          name="reminderTaskDaysBefore"
                          type="number"
                          min={1}
                          className="field-input field-input--inline"
                          value={reminderTaskDays}
                          onChange={(e) => setReminderTaskDays(e.target.value)}
                        />{" "}
                        days before
                      </span>
                    </span>
                  </label>
                  <div className="event-assignee-field">
                    <span className="form-field__label">Who prepares the filing</span>
                    <p className="event-assignee-field__hint">
                      Separate from the responsible attorney.
                    </p>
                    <div className="event-assignee-toggles">
                      <EventAssigneeToggle
                        name={andreaPrepName}
                        role="Operations & filing prep"
                        checked={prepAssignAndrea}
                        disabled={submitting}
                        onChange={setPrepAssignAndrea}
                      />
                      <EventAssigneeToggle
                        name={jasPrepName}
                        role="Field / liaison prep"
                        checked={prepAssignJas}
                        disabled={submitting}
                        onChange={setPrepAssignJas}
                      />
                    </div>
                    {!prepAssignAndrea && !prepAssignJas ? (
                      <p className="entry-form__inline-hint entry-form__inline-hint--warn">
                        Select at least one person for filing prep.
                      </p>
                    ) : null}
                    <input type="hidden" name="prepAssignedTo" value={prepAssignedTo} />
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        </EntryFormSection>

        <EntryFormSection step={4} title="Agenda & notes" hint="What to prepare, prior steps, and next steps">
          <EntryField
            label="Agenda"
            name="details"
            textarea
            required
            large
            placeholder="Hearing particulars, filing instructions, or meeting agenda"
          />
          <div className="form-grid form-grid--2">
            <EntryField label="Previous action" name="previousAction" textarea optional placeholder="Last step taken" />
            <EntryField label="Next action" name="nextAction" textarea optional placeholder="Recommended next step" />
          </div>
          <EntryField label="Remarks" name="remarks" textarea optional placeholder="Internal notes" />
        </EntryFormSection>

        <EntryFormSection step={5} title="Reminders & calendar" hint="When to remind staff and whether to sync">
          <div className="entry-form__options-row">
            <EntryField label="Reminder days before" name="reminderDays" type="number" defaultValue="1" />
            <CalendarSyncCheck />
          </div>
          <p className="entry-form__inline-hint">
            Calendar sync pushes this event to Google Calendar immediately when you save (when checked).
          </p>
        </EntryFormSection>
      </div>

      <EntryFormFooter
        busy={submitting}
        label="Add event"
        savingLabel="Saving event…"
        status={formStatus}
        error={formError || undefined}
        submitDisabled={submitting || busy}
      />

      <EventAddScheduleEmailDialog
        open={scheduleEmailOpen}
        draft={scheduleDraft}
        initialRecipientEmails={parseContactEmails(clientEmail)}
        busy={busy || submitting || scheduleSending}
        onClose={() => setScheduleEmailOpen(false)}
        onSaveEvent={saveEventForScheduleEmail}
        onSent={(saved) => void onScheduleEmailComplete?.(saved)}
        onStatus={onStatus}
      />
    </form>
  );
}

function EntryFormHero({
  variant,
  eyebrow,
  title,
  subtitle
}: {
  variant: "task" | "event";
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  const badge = variant === "task" ? "T" : "H";
  return (
    <header className={`entry-form__hero entry-form__hero--${variant}`}>
      <div className="entry-form__hero-badge" aria-hidden>
        {badge}
      </div>
      <div className="entry-form__hero-text">
        <p className="entry-form__eyebrow">{eyebrow}</p>
        <h2 className="entry-form__title">{title}</h2>
        <p className="entry-form__subtitle">{subtitle}</p>
      </div>
    </header>
  );
}

function EntryFormSection({
  step,
  title,
  hint,
  children
}: {
  step: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="entry-form__section">
      <div className="entry-form__section-head">
        <span className="entry-form__step" aria-hidden>
          {step}
        </span>
        <div>
          <h3 className="entry-form__section-title">{title}</h3>
          {hint ? <p className="entry-form__section-hint">{hint}</p> : null}
        </div>
      </div>
      <div className="entry-form__section-body">{children}</div>
    </section>
  );
}

function EntryField({
  label,
  name,
  type = "text",
  required,
  optional,
  textarea,
  large,
  list,
  defaultValue,
  placeholder
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  textarea?: boolean;
  large?: boolean;
  list?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const inputClass = ["field-input", textarea ? "field-input--textarea" : "", large ? "field-input--large" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="form-field">
      <span className="form-field__label">
        {label}
        {required ? <span className="form-field__required"> *</span> : null}
        {optional ? <span className="form-field__optional"> (optional)</span> : null}
      </span>
      {textarea ? (
        <textarea name={name} className={inputClass} required={required} placeholder={placeholder} />
      ) : (
        <input
          name={name}
          type={type}
          className={inputClass}
          required={required}
          list={list}
          defaultValue={defaultValue}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

function EntrySelect({
  label,
  name,
  options,
  value,
  onValueChange,
  allowBlank,
  blankLabel
}: {
  label: string;
  name: string;
  options: string[];
  value?: string;
  onValueChange?: (value: string) => void;
  allowBlank?: boolean;
  blankLabel?: string;
}) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      <select
        name={name}
        className="field-input"
        value={value}
        onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
      >
        {allowBlank ? <option value="">{blankLabel || "—"}</option> : null}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function CalendarSyncCheck() {
  return (
    <label className="form-check form-check--premium">
      <input name="calendarSync" type="checkbox" />
      <span className="form-check__copy">
        <span className="form-check__text">Sync to Google Calendar</span>
        <span className="form-check__hint">Push to Google Calendar when you save</span>
      </span>
    </label>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { ClientCasePicker, type ClientCasePickerHandle } from "@/components/office-tasks/ClientCasePicker";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import {
  computeResponsiveFilingDate,
  isAppearanceCategory,
  isPleadingCategory,
  platformOptionsForEventCategory,
  resolveEventCategory,
  resolveEventPlatform,
  isScheduleConfirmationEvent,
  splitEventCategory,
  splitEventPlatform
} from "@/lib/office-tasks/event-form-utils";
import { EventSegmentedControl } from "@/components/office-tasks/EventSegmentedControl";
import { EventScheduleEmailPanel } from "@/components/office-tasks/EventScheduleEmailPanel";
import { displayRemarks } from "@/lib/office-tasks/follow-up-marker";
import { todayYmd } from "@/lib/office-tasks/schedule";
import type { CaseOption } from "@/lib/gl-config";

const PERIOD_PRESETS = [5, 10, 15, 30] as const;

type Props = {
  item: EditableItem;
  options: EntryFormOptions;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (payload: Record<string, unknown>) => void;
};

export function EventEditForm({ item, options, busy, onClose, onConfirm }: Props) {
  const casePickerRef = useRef<ClientCasePickerHandle>(null);
  const venueTouched = useRef(Boolean(item.venue?.trim()));
  const responsibleTouched = useRef(Boolean(item.assignedTo?.trim()));
  const selectedCaseRef = useRef<CaseOption | null>(null);

  const split = splitEventCategory(item.category || "Hearing");
  const knownCategory = options.eventCategories.includes(split.category);
  const [category, setCategory] = useState(knownCategory ? split.category : "Other");
  const [categoryOther, setCategoryOther] = useState(
    knownCategory ? split.categoryOther : split.category === "Other" ? split.categoryOther : item.category || ""
  );
  const [venue, setVenue] = useState(item.venue || "");
  const [responsible, setResponsible] = useState(item.assignedTo || "");
  const [pleadingType, setPleadingType] = useState(item.pleadingType || options.pleadingTypes[0] || "Initiatory pleading");
  const [pleadingCaseNature, setPleadingCaseNature] = useState(
    item.pleadingCaseNature || options.pleadingCaseNatures[0] || "Civil/Administrative"
  );
  const [receivedDate, setReceivedDate] = useState(item.receivedDate || todayYmd());
  const [periodDays, setPeriodDays] = useState(String(item.periodToFileDays || 15));
  const [details, setDetails] = useState(item.details || "");
  const [previousAction, setPreviousAction] = useState(item.previousAction || "");
  const [nextAction, setNextAction] = useState(item.nextAction || "");
  const [remarks, setRemarks] = useState(displayRemarks(item.remarks || ""));
  const [eventDate, setEventDate] = useState(item.eventDate || "");
  const [filingDeadline, setFilingDeadline] = useState(item.filingDeadline || "");
  const [startTime, setStartTime] = useState(item.startTime || "");
  const [endTime, setEndTime] = useState(item.endTime || "");
  const [priority, setPriority] = useState(item.priority || "Medium");
  const [status, setStatus] = useState(item.status || "Scheduled");
  const platformSplit = splitEventPlatform(item.platform || "");
  const hearingCategory = knownCategory ? split.category : "Other";
  const initialPlatform =
    hearingCategory === "Hearing" &&
    platformSplit.platform &&
    !(platformOptionsForEventCategory("Hearing", options.platforms) as readonly string[]).includes(
      platformSplit.platform
    )
      ? "Other"
      : platformSplit.platform;
  const initialPlatformOther =
    hearingCategory === "Hearing" && initialPlatform === "Other"
      ? platformSplit.platformOther ||
        (platformSplit.platform &&
        !(platformOptionsForEventCategory("Hearing", options.platforms) as readonly string[]).includes(
          platformSplit.platform
        )
          ? platformSplit.platform
          : "")
      : platformSplit.platformOther;
  const [platform, setPlatform] = useState(initialPlatform);
  const [platformOther, setPlatformOther] = useState(initialPlatformOther);
  const [filingMode, setFilingMode] = useState(item.filingMode || "");
  const [reminderDays, setReminderDays] = useState(String(item.reminderDays ?? 1));
  const [calendarSync, setCalendarSync] = useState(item.calendarSync === true);
  const [clientCase, setClientCase] = useState(item.clientCase || "");
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"edit" | "email">("edit");
  const [emailNote, setEmailNote] = useState("");

  const computedFilingDate = useMemo(() => {
    if (pleadingType !== "Responsive pleading") return "";
    return computeResponsiveFilingDate(receivedDate, Number(periodDays) || 0);
  }, [pleadingType, receivedDate, periodDays]);

  const showAppearance = isAppearanceCategory(category);
  const showPleading = isPleadingCategory(category);
  const showHearingPrep = category === "Hearing";
  const effectiveFilingDeadline = showPleading && pleadingType === "Responsive pleading" ? computedFilingDate : filingDeadline;
  const resolvedCategory = resolveEventCategory(category, categoryOther);
  const scheduleItem = {
    ...item,
    source: "Event" as const,
    clientCase,
    category: resolvedCategory,
    platform: resolveEventPlatform(platform, platformOther),
    venue,
    details,
    assignedTo: responsible,
    eventDate,
    date: eventDate || filingDeadline || item.date,
    startTime,
    endTime
  };
  const showScheduleEmail = isScheduleConfirmationEvent(scheduleItem);

  function handleCaseSelect(option: CaseOption | null) {
    selectedCaseRef.current = option;
    if (option?.label) setClientCase(option.label);
    if (!option) return;
    if (!venueTouched.current && option.courtPending) setVenue(option.courtPending);
    if (!responsibleTouched.current && option.assignedAttorney) setResponsible(option.assignedAttorney);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    void (async () => {
      let resolvedClientCase = clientCase;
      try {
        const resolved = await casePickerRef.current?.resolveClientCase();
        if (resolved) resolvedClientCase = resolved;
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Could not save client / case.");
        return;
      }

      if (!resolvedClientCase.trim() || !responsible.trim() || !details.trim()) {
        setError("Client/case, responsible person, and agenda are required.");
        return;
      }
    if (category === "Other" && !categoryOther.trim()) {
      setError("Specify what kind of event this is when Other is selected.");
      return;
    }
    if (showAppearance && !eventDate.trim()) {
      setError("Enter the hearing / appearance date.");
      return;
    }
    if (showHearingPrep && platform === "Other" && !platformOther.trim()) {
      setError("Specify the platform when Other is selected.");
      return;
    }
    if (showPleading) {
      if (!filingMode.trim()) {
        setError("Select a filing mode.");
        return;
      }
      if (!pleadingCaseNature.trim()) {
        setError("Select civil/administrative or criminal.");
        return;
      }
      if (pleadingType === "Responsive pleading") {
        if (!receivedDate.trim() || Number(periodDays) < 1) {
          setError("Enter received date and period to file.");
          return;
        }
      } else if (!effectiveFilingDeadline.trim()) {
        setError("Enter the due / filing deadline.");
        return;
      }
    } else if (!eventDate.trim() && !filingDeadline.trim()) {
      setError("Enter an event date or filing deadline.");
      return;
    }

    onConfirm({
      source: "Event",
      rowNumber: item.rowNumber,
      itemId: item.id,
      clientCase: resolvedClientCase.trim(),
      eventDate: showAppearance ? eventDate : showPleading ? "" : eventDate,
      filingDeadline: showPleading ? effectiveFilingDeadline : showAppearance ? "" : filingDeadline,
      startTime,
      endTime,
      category,
      categoryOther: category === "Other" ? categoryOther.trim() : "",
      priority,
      responsible: responsible.trim(),
      venue,
      platform: resolveEventPlatform(platform, platformOther),
      filingMode: showPleading ? filingMode : "",
      pleadingType: showPleading ? pleadingType : "",
      pleadingCaseNature: showPleading ? pleadingCaseNature : "",
      receivedDate: showPleading && pleadingType === "Responsive pleading" ? receivedDate : "",
      periodToFileDays: showPleading && pleadingType === "Responsive pleading" ? Number(periodDays) : 0,
      filingDate: showPleading && pleadingType === "Responsive pleading" ? computedFilingDate : "",
      details: details.trim(),
      previousAction,
      nextAction,
      remarks,
      status,
      reminderDays: Number(reminderDays || 1),
      calendarSync
    });
    })();
  }

  return (
    <div className="event-edit-form space-y-4">
      {showScheduleEmail ? (
        <div className="refine-segment flex gap-1 border-b border-line pb-2">
          <button
            type="button"
            className={`refine-segment__btn ${panel === "edit" ? "refine-segment__btn--active" : ""}`}
            onClick={() => setPanel("edit")}
          >
            Edit event
          </button>
          <button
            type="button"
            className={`refine-segment__btn ${panel === "email" ? "refine-segment__btn--active" : ""}`}
            onClick={() => setPanel("email")}
          >
            Confirm email
          </button>
        </div>
      ) : null}

      {panel === "email" && showScheduleEmail ? (
        <EventScheduleEmailPanel
          item={scheduleItem}
          customNote={emailNote}
          onCustomNoteChange={setEmailNote}
        />
      ) : (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <ClientCasePicker
        ref={casePickerRef}
        required
        highlight
        sortByClientCode
        compactContactLayout
        defaultValue={item.clientCase || ""}
        onCaseSelect={handleCaseSelect}
      />

      <EventSegmentedControl
        label="Event type"
        required
        options={options.eventCategories}
        value={category}
        onChange={setCategory}
        otherValue={categoryOther}
        onOtherChange={setCategoryOther}
        otherPlaceholder="Specify event type…"
        aria-label="Event type"
      />

      <div className="form-grid form-grid--2">
        <EditSelect label="Status" value={status} options={[...new Set([...options.eventCreateStatuses, "Done", "Submitted"])]} onChange={setStatus} />
        <EditSelect label="Priority" value={priority} options={options.priorities} onChange={setPriority} />
      </div>

      <EditField label="Responsible *" value={responsible} onChange={(value) => {
        responsibleTouched.current = true;
        setResponsible(value);
      }} list="employees" />
      <div className="form-grid form-grid--2">
        <EditField label="Venue" value={venue} onChange={(value) => {
          venueTouched.current = true;
          setVenue(value);
        }} />
        {!showHearingPrep ? (
          <EditSelect
            label="Platform"
            value={platform}
            options={["", ...platformOptionsForEventCategory(category, options.platforms)]}
            onChange={setPlatform}
            blankFirst
          />
        ) : null}
      </div>
      {showHearingPrep ? (
        <>
          <EventSegmentedControl
            label="Platform"
            options={platformOptionsForEventCategory("Hearing", options.platforms)}
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

      {showAppearance ? (
        <>
          <div className="form-grid form-grid--2">
            <EditField label="Hearing / appearance date *" type="date" value={eventDate} onChange={setEventDate} />
            <EditField label="End time" type="time" value={endTime} onChange={setEndTime} />
          </div>
          <div className="form-grid form-grid--2">
            <EditField label="Start time" type="time" value={startTime} onChange={setStartTime} />
          </div>
        </>
      ) : null}

      {showPleading ? (
        <>
          <div className="form-grid form-grid--2">
            <EditSelect label="Pleading type *" value={pleadingType} options={options.pleadingTypes} onChange={setPleadingType} />
            <EditSelect
              label="Case nature *"
              value={pleadingCaseNature}
              options={options.pleadingCaseNatures}
              onChange={setPleadingCaseNature}
            />
          </div>
          <div className="form-grid form-grid--2">
            <EditSelect label="Filing mode *" value={filingMode} options={options.filingModes} onChange={setFilingMode} />
          </div>
          {pleadingType === "Initiatory pleading" ? (
            <EditField label="Due date *" type="date" value={filingDeadline} onChange={setFilingDeadline} />
          ) : (
            <>
              <div className="form-grid form-grid--2">
                <EditField label="Date received *" type="date" value={receivedDate} onChange={setReceivedDate} />
                <EditField label="Period to file (days) *" type="number" value={periodDays} onChange={setPeriodDays} />
              </div>
              <EventSegmentedControl
                compact
                label="Quick period"
                options={PERIOD_PRESETS.map((days) => `${days} days`)}
                value={`${periodDays} days`}
                onChange={(label) => setPeriodDays(label.replace(/\s*days$/, ""))}
                aria-label="Quick period to file"
              />
              <div className="event-computed-date">
                <span className="event-computed-date__label">Computed filing deadline</span>
                <strong>{computedFilingDate || "Enter received date and period"}</strong>
              </div>
            </>
          )}
        </>
      ) : null}

      {!showAppearance && !showPleading ? (
        <div className="form-grid form-grid--2">
          <EditField label="Event date" type="date" value={eventDate} onChange={setEventDate} />
          <EditField label="Due / deadline" type="date" value={filingDeadline} onChange={setFilingDeadline} />
        </div>
      ) : null}

      <EditField label="Agenda / details *" value={details} onChange={setDetails} textarea large />
      <div className="form-grid form-grid--2">
        <EditField label="Previous action" value={previousAction} onChange={setPreviousAction} textarea />
        <EditField label="Next action" value={nextAction} onChange={setNextAction} textarea />
      </div>
      <EditField label="Remarks" value={remarks} onChange={setRemarks} textarea />

      <div className="form-grid form-grid--2">
        <EditField label="Reminder days before" type="number" value={reminderDays} onChange={setReminderDays} />
        <label className="form-check form-check--premium mt-6">
          <input type="checkbox" checked={calendarSync} onChange={(e) => setCalendarSync(e.target.checked)} />
          <span className="form-check__copy">
            <span className="form-check__text">Sync to Google Calendar</span>
            <span className="form-check__hint">Pushes to calendar when you save</span>
          </span>
        </label>
      </div>

      {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary !text-xs" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn-primary !text-xs" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
      )}
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
  textarea,
  large,
  list
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  textarea?: boolean;
  large?: boolean;
  list?: string;
}) {
  const inputClass = ["field-input", textarea ? "field-input--textarea" : "", large ? "field-input--large" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      {textarea ? (
        <textarea className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={inputClass} type={type} value={value} list={list} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function EditSelect({
  label,
  value,
  options,
  onChange,
  blankFirst
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  blankFirst?: boolean;
}) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      <select className="field-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {blankFirst ? <option value="">Select platform…</option> : null}
        {options.filter(Boolean).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

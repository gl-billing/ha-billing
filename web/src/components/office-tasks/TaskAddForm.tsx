"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { ClientCasePicker, type ClientCasePickerHandle } from "@/components/office-tasks/ClientCasePicker";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import {
  defaultTaskChecklistItems,
  TASK_OFFICE_VENUE_PRESETS
} from "@/lib/office-tasks/task-form-utils";
import type { CaseOption } from "@/lib/gl-config";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { EntryFormFooter } from "@/components/office-tasks/EntryFormFooter";
import { EventSegmentedControl } from "@/components/office-tasks/EventSegmentedControl";
import type { FormSaveStatus } from "@/lib/firm-status-report";

type TaskFormProps = {
  options: EntryFormOptions;
  busy: boolean;
  billingAccess?: boolean;
  onSubmit: (form: HTMLFormElement, clientCase: string) => void | Promise<void>;
  onStatus?: (message: string, isError?: boolean) => void;
};

export function TaskAddForm({ options, busy, billingAccess = true, onSubmit, onStatus }: TaskFormProps) {
  const casePickerRef = useRef<ClientCasePickerHandle>(null);
  const venueTouched = useRef(false);
  const assigneeTouched = useRef(false);
  const selectedCaseRef = useRef<CaseOption | null>(null);
  const taskTypes = options.taskFormTypes?.length ? options.taskFormTypes : options.taskTypes;

  const [taskType, setTaskType] = useState(taskTypes[0] || "Task");
  const [taskTypeOther, setTaskTypeOther] = useState("");
  const [venue, setVenue] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [useChecklist, setUseChecklist] = useState(false);
  const [includedStandard, setIncludedStandard] = useState<string[]>([]);
  const [customChecklistItems, setCustomChecklistItems] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [formError, setFormError] = useState("");
  const [formStatus, setFormStatus] = useState<FormSaveStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formBusy = submitting;

  const standardOptions = useMemo(() => defaultTaskChecklistItems(taskType), [taskType]);
  const checklistItems = useMemo(
    () => [...includedStandard, ...customChecklistItems],
    [includedStandard, customChecklistItems]
  );
  const showCourtVenueHint = taskType === "Court Follow-up" || taskType === "Administrative" || taskType === "Task";

  function applyCaseDefaults(option: CaseOption | null) {
    if (!option) return;
    if (!venueTouched.current && option.courtPending) setVenue(option.courtPending);
    if (!assigneeTouched.current && option.assignedAttorney) setAssignedTo(option.assignedAttorney);
  }

  function handleCaseSelect(option: CaseOption | null) {
    selectedCaseRef.current = option;
    applyCaseDefaults(option);
  }

  function selectTaskType(next: string) {
    setTaskType(next);
    setCustomChecklistItems([]);
    setNewChecklistItem("");
    if (useChecklist) {
      setIncludedStandard([...defaultTaskChecklistItems(next)]);
    }
    if (next === "Court Follow-up" || next === "Administrative") {
      applyCaseDefaults(selectedCaseRef.current);
    }
  }

  function toggleUseChecklist() {
    setUseChecklist((current) => {
      const next = !current;
      if (next) {
        setIncludedStandard([...standardOptions]);
      }
      return next;
    });
  }

  function toggleStandardItem(item: string) {
    setIncludedStandard((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item]
    );
  }

  function addCustomChecklistItem() {
    const next = newChecklistItem.trim();
    if (!next) return;
    const duplicate = checklistItems.some((item) => item.toLowerCase() === next.toLowerCase());
    if (duplicate) {
      setNewChecklistItem("");
      return;
    }
    setCustomChecklistItems((current) => [...current, next]);
    setNewChecklistItem("");
  }

  function removeCustomChecklistItem(index: number) {
    setCustomChecklistItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function reportError(message: string) {
    setFormError(message);
    setFormStatus({ phase: "error", message });
    onStatus?.(message, true);
  }

  async function handleSubmit(form: HTMLFormElement) {
    setFormError("");
    setFormStatus({ phase: "processing", message: "Saving task to spreadsheet…" });
    setSubmitting(true);
    try {
      const clientCase = await casePickerRef.current?.resolveClientCase();
      if (!clientCase) {
        reportError("Select or enter a client / case before saving.");
        return;
      }
      const hidden = form.querySelector('input[name="clientCase"]') as HTMLInputElement | null;
      if (hidden) hidden.value = clientCase;
      if (useChecklist && checklistItems.length === 0) {
        reportError("Select at least one checklist item, or turn off Add checklist.");
        return;
      }
      await onSubmit(form, clientCase);
      setFormStatus(null);
    } catch (error) {
      reportError(error instanceof Error ? error.message : "Could not save task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="entry-form entry-form--task"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit(e.currentTarget);
      }}
    >
      <input type="hidden" name="taskType" value={taskType} />

      <EntryFormHero
        variant="task"
        eyebrow="Schedule"
        title="New task"
        subtitle="Assign work to a matter with a due date."
      />

      <div className="entry-form__layout">
        <div className="entry-form__primary">
          <EntryFormSection title="Matter">
            <ClientCasePicker
              ref={casePickerRef}
              required
              highlight
              sortByClientCode
              autoFocusOnMount
              billingAccess={billingAccess}
              onStatus={onStatus}
              onCaseSelect={handleCaseSelect}
            />
          </EntryFormSection>

          <EntryFormSection title="Assignment">
            <EventSegmentedControl
              label="Type"
              required
              options={taskTypes}
              value={taskType}
              onChange={selectTaskType}
              otherValue={taskTypeOther}
              onOtherChange={setTaskTypeOther}
              otherInputName="taskTypeOther"
              otherPlaceholder="Specify type…"
              aria-label="Task type"
            />

            <div className="entry-form__grid entry-form__grid--2">
              <EntrySelect label="Status" name="status" options={options.taskCreateStatuses} />
              <EntrySelect label="Priority" name="priority" options={options.priorities} />
            </div>

            <div className="entry-form__grid entry-form__grid--2">
              <label className="form-field">
                <span className="form-field__label">
                  Assigned to<span className="form-field__required"> *</span>
                </span>
                <input
                  name="assignedTo"
                  className="field-input"
                  list="employees"
                  required
                  value={assignedTo}
                  placeholder="Staff in charge"
                  onChange={(e) => {
                    assigneeTouched.current = true;
                    setAssignedTo(e.target.value);
                  }}
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Venue / office</span>
                <input
                  name="venue"
                  className="field-input"
                  list="task-venues"
                  value={venue}
                  placeholder="Court, agency, client office…"
                  onChange={(e) => {
                    venueTouched.current = true;
                    setVenue(e.target.value);
                  }}
                />
              </label>
            </div>
            <datalist id="task-venues">
              {TASK_OFFICE_VENUE_PRESETS.map((preset) => (
                <option key={preset} value={preset} />
              ))}
            </datalist>

            {showCourtVenueHint ? (
              <p className="entry-form__inline-hint">
                Include branch or office for court runs and agency filings.
              </p>
            ) : null}
          </EntryFormSection>

          <EntryFormSection title="Work">
            <div className="entry-form__grid entry-form__grid--2">
              <EntryField label="Due date *" name="dueDate" type="date" required defaultValue={todayYmd()} />
              <EntryField label="Time" name="dueTime" type="time" optional placeholder="All day if blank" />
            </div>

            <EntryField
              label="Description *"
              name="description"
              textarea
              required
              large
              placeholder="What needs to be done"
            />

            <EntryField
              label="Work notes"
              name="workNotes"
              textarea
              optional
              placeholder="Documents, contacts, filing details…"
            />
          </EntryFormSection>
        </div>

        <aside className="entry-form__secondary">
          <details className="entry-form__panel">
            <summary className="entry-form__panel-summary">Checklist</summary>
            <div className="entry-form__panel-body">
              <div className="task-checklist-option">
                <div className="task-checklist-option__head">
                  <button
                    type="button"
                    className={`task-checklist-toggle ${useChecklist ? "task-checklist-toggle--on" : ""}`}
                    role="checkbox"
                    aria-checked={useChecklist}
                    aria-label="Add checklist"
                    disabled={formBusy}
                    onClick={toggleUseChecklist}
                  />
                  <div className="task-checklist-option__copy">
                    <button
                      type="button"
                      className="task-checklist-option__label"
                      disabled={formBusy}
                      onClick={toggleUseChecklist}
                    >
                      Prep checklist
                    </button>
                    <p className="task-checklist-option__hint">Suggested items for this type — tick off after saving.</p>
                  </div>
                </div>
                {useChecklist ? (
                  <div className="task-checklist-editor">
                    <input type="hidden" name="createInteractiveChecklist" value="on" />
                    {checklistItems.map((item, index) => (
                      <input key={`${item}-${index}`} type="hidden" name="checklistItem" value={item} />
                    ))}
                    <div className="hearing-prep-checklist__grid task-checklist-editor__options">
                      {standardOptions.map((item) => (
                        <label key={item} className="form-check hearing-prep-checklist__item">
                          <input
                            type="checkbox"
                            checked={includedStandard.includes(item)}
                            disabled={formBusy}
                            onChange={() => toggleStandardItem(item)}
                          />
                          <span className="form-check__text">{item}</span>
                        </label>
                      ))}
                    </div>
                    {customChecklistItems.length ? (
                      <ul className="task-checklist-editor__custom">
                        {customChecklistItems.map((item, index) => (
                          <li key={`${item}-${index}`} className="task-checklist-editor__custom-item">
                            <span>{item}</span>
                            <button
                              type="button"
                              className="task-checklist-editor__remove"
                              disabled={formBusy}
                              onClick={() => removeCustomChecklistItem(index)}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="task-checklist-editor__add">
                      <input
                        className="field-input"
                        value={newChecklistItem}
                        disabled={formBusy}
                        placeholder="Add item…"
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomChecklistItem();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="task-checklist-editor__add-btn"
                        disabled={formBusy || !newChecklistItem.trim()}
                        onClick={addCustomChecklistItem}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </details>

          <details className="entry-form__panel">
            <summary className="entry-form__panel-summary">Follow-up</summary>
            <div className="entry-form__panel-body entry-form__panel-body--stack">
              <EntryField label="Previous action" name="previousAction" textarea optional />
              <EntryField label="Next action" name="nextAction" textarea optional />
              <EntryField label="Remarks" name="remarks" textarea optional />
            </div>
          </details>

          <div className="entry-form__panel entry-form__panel--static">
            <p className="entry-form__panel-summary entry-form__panel-summary--static">Reminders</p>
            <div className="entry-form__panel-body">
              <div className="entry-form__options-row">
                <EntryField label="Days before" name="reminderDays" type="number" defaultValue="1" />
                <CalendarSyncCheck />
              </div>
            </div>
          </div>
        </aside>
      </div>

      <EntryFormFooter
        busy={submitting}
        label="Add task"
        savingLabel="Saving task…"
        status={formStatus}
        error={formError || undefined}
        submitDisabled={submitting || busy}
      />
    </form>
  );
}

export function EntryFormHero({
  variant,
  eyebrow,
  title,
  subtitle
}: {
  variant: "task" | "event";
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className={`entry-form__hero entry-form__hero--${variant}`}>
      <div className="entry-form__hero-text">
        <p className="entry-form__eyebrow">{eyebrow}</p>
        <h2 id="edit-item-title" className="entry-form__title">
          {title}
        </h2>
        {subtitle ? <p className="entry-form__subtitle">{subtitle}</p> : null}
      </div>
    </header>
  );
}

export function EntryFormSection({
  step,
  title,
  hint,
  children
}: {
  step?: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="entry-form__section">
      <div className="entry-form__section-head">
        {step != null ? (
          <span className="entry-form__step" aria-hidden>
            {step}
          </span>
        ) : null}
        <div className="entry-form__section-head-text">
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
          defaultValue={defaultValue}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

function EntrySelect({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      <select name={name} className="field-input">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
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

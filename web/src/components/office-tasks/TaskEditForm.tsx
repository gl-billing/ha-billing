"use client";

import { useMemo, useRef, useState } from "react";
import { ClientCasePicker, type ClientCasePickerHandle } from "@/components/office-tasks/ClientCasePicker";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import {
  EntryFormHero,
  EntryFormSection
} from "@/components/office-tasks/TaskAddForm";
import {
  parseTaskWorkDetails,
  prepChecklistForTaskType,
  splitTaskType,
  TASK_OFFICE_VENUE_PRESETS
} from "@/lib/office-tasks/task-form-utils";
import type { CaseOption } from "@/lib/gl-config";
import { displayRemarks } from "@/lib/office-tasks/follow-up-marker";
import { EventSegmentedControl } from "@/components/office-tasks/EventSegmentedControl";

type Props = {
  item: EditableItem;
  options: EntryFormOptions;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (payload: Record<string, unknown>) => void;
};

export function TaskEditForm({ item, options, busy, onClose, onConfirm }: Props) {
  const casePickerRef = useRef<ClientCasePickerHandle>(null);
  const venueTouched = useRef(Boolean(item.venue?.trim()));
  const assigneeTouched = useRef(true);
  const selectedCaseRef = useRef<CaseOption | null>(null);

  const parsedWork = useMemo(() => parseTaskWorkDetails(item.details || ""), [item.details]);
  const splitType = useMemo(() => splitTaskType(item.category || "Task"), [item.category]);
  const taskTypes = options.taskFormTypes?.length ? options.taskFormTypes : options.taskTypes;
  const knownType = taskTypes.includes(splitType.taskType);

  const [taskType, setTaskType] = useState(knownType ? splitType.taskType : "Other");
  const [taskTypeOther, setTaskTypeOther] = useState(
    knownType ? splitType.taskTypeOther : splitType.taskTypeOther || item.category || ""
  );
  const [status, setStatus] = useState(item.status || "In Progress");
  const [priority, setPriority] = useState(item.priority || "Medium");
  const [assignedTo, setAssignedTo] = useState(item.assignedTo || "");
  const [venue, setVenue] = useState(item.venue || "");
  const [dueDate, setDueDate] = useState(item.date || "");
  const [dueTime, setDueTime] = useState(item.startTime || "");
  const [workNotes, setWorkNotes] = useState(parsedWork.workNotes);
  const [prepChecked, setPrepChecked] = useState<string[]>(parsedWork.prepItems);
  const [description, setDescription] = useState(parsedWork.description);
  const [previousAction, setPreviousAction] = useState(item.previousAction || "");
  const [nextAction, setNextAction] = useState(item.nextAction || "");
  const [remarks, setRemarks] = useState(displayRemarks(item.remarks || ""));
  const [reminderDays, setReminderDays] = useState(String(item.reminderDays ?? 1));
  const [calendarSync, setCalendarSync] = useState(item.calendarSync === true);
  const [error, setError] = useState("");

  const prepItems = useMemo(() => [...prepChecklistForTaskType(taskType)], [taskType]);
  const showCourtVenueHint = taskType === "Court Follow-up" || taskType === "Administrative" || taskType === "Task";
  const statusOptions = [...new Set([...options.taskCreateStatuses, "Done"])];

  function applyCaseDefaults(option: CaseOption | null) {
    if (option) selectedCaseRef.current = option;
    if (!option) return;
    if (!venueTouched.current && option.courtPending) setVenue(option.courtPending);
    if (!assigneeTouched.current && option.assignedAttorney) setAssignedTo(option.assignedAttorney);
  }

  function selectTaskType(next: string) {
    setTaskType(next);
    setPrepChecked([]);
    if (next === "Court Follow-up" || next === "Administrative") {
      applyCaseDefaults(selectedCaseRef.current);
    }
  }

  function togglePrep(prepItem: string) {
    setPrepChecked((current) =>
      current.includes(prepItem) ? current.filter((value) => value !== prepItem) : [...current, prepItem]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    let clientCase = item.clientCase || "";
    try {
      const resolved = await casePickerRef.current?.resolveClientCase();
      if (resolved) clientCase = resolved;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save client / case.");
      return;
    }

    if (!clientCase.trim()) {
      setError("Select or enter a client / case before saving.");
      return;
    }
    if (!assignedTo.trim()) {
      setError("Assigned person is required.");
      return;
    }
    if (!dueDate.trim()) {
      setError("Enter the task date.");
      return;
    }
    if (!description.trim()) {
      setError("Agenda / work description is required.");
      return;
    }
    if (taskType === "Other" && !taskTypeOther.trim()) {
      setError("Specify what kind of task this is when Other is selected.");
      return;
    }

    onConfirm({
      source: "Task",
      rowNumber: item.rowNumber,
      itemId: item.id,
      clientCase: clientCase.trim(),
      assignedTo: assignedTo.trim(),
      dueDate,
      dueTime,
      venue,
      priority,
      taskType,
      taskTypeOther: taskType === "Other" ? taskTypeOther.trim() : "",
      description,
      workNotes,
      taskPrep: prepChecked,
      previousAction,
      nextAction,
      remarks,
      status,
      reminderDays: Number(reminderDays || 1),
      calendarSync
    });
  }

  return (
    <form className="entry-form entry-form--task entry-form--edit" onSubmit={handleSubmit}>
      <EntryFormHero
        variant="task"
        eyebrow="Master Tasks"
        title="Edit task"
        subtitle={`${item.clientCase || "—"} · ${item.id || "no code"}`}
      />

      <div className="entry-form__body">
        <EntryFormSection step={1} title="Case" hint="Which client matter is this task for?">
          <ClientCasePicker
            ref={casePickerRef}
            required
            highlight
            defaultValue={item.clientCase || ""}
            onCaseSelect={applyCaseDefaults}
          />
        </EntryFormSection>

        <EntryFormSection
          step={2}
          title="Task type & assignment"
          hint="What kind of work, who handles it, and where they go"
        >
          <div className="entry-form__inset entry-form__inset--tiles">
            <EventSegmentedControl
              label="Task type"
              required
              options={taskTypes}
              value={taskType}
              onChange={selectTaskType}
              otherValue={taskTypeOther}
              onOtherChange={setTaskTypeOther}
              otherPlaceholder="e.g. ROD processing, BIR filing…"
              aria-label="Task type"
            />

            <div className="form-grid form-grid--2 mt-3">
              <EditSelect label="Status" value={status} options={statusOptions} onChange={setStatus} />
              <EditSelect label="Priority" value={priority} options={options.priorities} onChange={setPriority} />
            </div>

            <EditField
              label="Assigned to *"
              value={assignedTo}
              list="employees"
              placeholder="Jas, Andrea, or staff in charge"
              onChange={(value) => {
                assigneeTouched.current = true;
                setAssignedTo(value);
              }}
            />

            <EditField
              label="Venue / office"
              value={venue}
              list="task-venues-edit"
              placeholder="Court branch, ROD, BIR, agency, client office…"
              onChange={(value) => {
                venueTouched.current = true;
                setVenue(value);
              }}
            />
            <datalist id="task-venues-edit">
              {TASK_OFFICE_VENUE_PRESETS.map((preset) => (
                <option key={preset} value={preset} />
              ))}
            </datalist>

            {showCourtVenueHint ? (
              <p className="entry-form__inline-hint">
                For court filing trips, serving demand letters, or agency runs — specify the court branch or office.
              </p>
            ) : null}
          </div>
        </EntryFormSection>

        <EntryFormSection step={3} title="Task date & prep" hint="When the work is due and what to bring">
          <div className="entry-form__inset">
            <div className="form-grid form-grid--2">
              <EditField label="Task date *" type="date" value={dueDate} onChange={setDueDate} />
              <EditField
                label="Time"
                type="time"
                value={dueTime}
                optional
                placeholder="Leave blank if all day"
                onChange={setDueTime}
              />
            </div>
            <EditField
              label="Work notes"
              value={workNotes}
              textarea
              optional
              placeholder="Filing instructions, documents to bring, contact at window, OR number…"
              onChange={setWorkNotes}
            />
            {prepItems.length ? (
              <div className="hearing-prep-checklist mt-3">
                <span className="form-field__label">Prep checklist</span>
                <div className="hearing-prep-checklist__grid">
                  {prepItems.map((prepItem) => (
                    <label key={prepItem} className="form-check hearing-prep-checklist__item">
                      <input
                        type="checkbox"
                        checked={prepChecked.includes(prepItem)}
                        onChange={() => togglePrep(prepItem)}
                      />
                      <span className="form-check__text">{prepItem}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </EntryFormSection>

        <EntryFormSection step={4} title="Agenda & notes" hint="Summary, prior steps, and next steps">
          <EditField
            label="Agenda / description *"
            value={description}
            textarea
            large
            placeholder="What needs to be done"
            onChange={setDescription}
          />
          <div className="form-grid form-grid--2">
            <EditField
              label="Previous action"
              value={previousAction}
              textarea
              optional
              placeholder="Last step taken"
              onChange={setPreviousAction}
            />
            <EditField
              label="Next action"
              value={nextAction}
              textarea
              optional
              placeholder="Recommended next step"
              onChange={setNextAction}
            />
          </div>
          <EditField label="Remarks" value={remarks} textarea optional placeholder="Internal notes" onChange={setRemarks} />
        </EntryFormSection>

        <EntryFormSection step={5} title="Reminders & calendar" hint="When to remind staff and whether to sync">
          <div className="entry-form__options-row">
            <EditField
              label="Reminder days before"
              type="number"
              value={reminderDays}
              onChange={setReminderDays}
            />
            <label className="form-check form-check--premium">
              <input type="checkbox" checked={calendarSync} onChange={(e) => setCalendarSync(e.target.checked)} />
              <span className="form-check__copy">
                <span className="form-check__text">Sync to Google Calendar</span>
                <span className="form-check__hint">Push to Google Calendar when you save</span>
              </span>
            </label>
          </div>
        </EntryFormSection>
      </div>

      {error ? <p className="entry-form__error text-xs font-semibold text-red-700">{error}</p> : null}

      <footer className="entry-form__footer entry-form__footer--dialog entry-form__footer--sticky-mobile">
        <button type="button" className="btn-secondary !text-xs" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn-primary !text-xs" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </footer>
    </form>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
  textarea,
  large,
  optional,
  list,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  textarea?: boolean;
  large?: boolean;
  optional?: boolean;
  list?: string;
  placeholder?: string;
}) {
  const inputClass = ["field-input", textarea ? "field-input--textarea" : "", large ? "field-input--large" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="form-field">
      <span className="form-field__label">
        {label}
        {optional ? <span className="form-field__optional"> (optional)</span> : null}
      </span>
      {textarea ? (
        <textarea
          className={inputClass}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={inputClass}
          type={type}
          value={value}
          list={list}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function EditSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      <select className="field-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

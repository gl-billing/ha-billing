"use client";

import { useMemo, useState } from "react";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import {
  isChecked,
  parsePrepChecklistState,
  prepChecklistProgress
} from "@/lib/office-tasks/prep-checklist-storage";

type Props = {
  remarks: string;
  title?: string;
  disabled?: boolean;
  collapsedDefault?: boolean;
  onToggleItem: (itemIndex: number, checked: boolean) => void;
  onMutateItem?: (mutation: PrepChecklistMutation) => void | Promise<void>;
};

export function TaskPrepChecklist({
  remarks,
  title = "Filing prep checklist",
  disabled,
  collapsedDefault = false,
  onToggleItem,
  onMutateItem
}: Props) {
  const state = useMemo(() => parsePrepChecklistState(remarks), [remarks]);
  const [open, setOpen] = useState(!collapsedDefault);
  const [editing, setEditing] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [draftLabels, setDraftLabels] = useState<string[]>([]);

  if (!state) return null;

  const progress = prepChecklistProgress(state);
  const complete = progress.done >= progress.total && progress.total > 0;
  const canMutate = Boolean(onMutateItem);
  const controlsDisabled = Boolean(disabled);

  function startEditing() {
    setDraftLabels([...state!.items]);
    setEditing(true);
  }

  function cancelEditing() {
    setDraftLabels([]);
    setEditing(false);
  }

  async function saveEdits() {
    if (!onMutateItem) return;
    const originalCount = state!.items.length;

    for (let index = 0; index < originalCount; index += 1) {
      const nextLabel = (draftLabels[index] || "").trim();
      const currentLabel = state!.items[index];
      if (!nextLabel) return;
      if (nextLabel !== currentLabel) {
        await onMutateItem({ action: "edit", itemIndex: index, label: nextLabel });
      }
    }

    for (let index = originalCount; index < draftLabels.length; index += 1) {
      const label = (draftLabels[index] || "").trim();
      if (!label) continue;
      await onMutateItem({ action: "add", label });
    }

    setEditing(false);
    setDraftLabels([]);
  }

  async function removeItem(index: number) {
    if (!onMutateItem || draftLabels.length <= 1) return;
    if (index < state!.items.length) {
      await onMutateItem({ action: "remove", itemIndex: index });
    }
    setDraftLabels((rows) => rows.filter((_, itemIndex) => itemIndex !== index));
  }

  function addDraftRow() {
    setDraftLabels((rows) => [...rows, ""]);
  }

  async function addItem() {
    const label = newItem.trim();
    if (!label || !onMutateItem) return;
    await onMutateItem({ action: "add", label });
    setNewItem("");
  }

  async function deleteChecklist() {
    if (!onMutateItem) return;
    if (
      !window.confirm(
        "Delete this checklist? All checked progress will be lost. You can enable a new checklist later if needed."
      )
    ) {
      return;
    }
    await onMutateItem({ action: "delete" });
  }

  return (
    <section className="task-prep-checklist no-print">
      <button
        type="button"
        className="task-prep-checklist__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="task-prep-checklist__title">{title}</span>
        <span className={`task-prep-checklist__progress ${complete ? "task-prep-checklist__progress--done" : ""}`}>
          {progress.done}/{progress.total} done
        </span>
        <span className="task-prep-checklist__chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && !editing ? (
        <ul className="task-prep-checklist__list">
          {state.items.map((label, index) => {
            const checked = isChecked(state, index);
            return (
              <li key={index} className={`task-prep-checklist__item ${checked ? "task-prep-checklist__item--done" : ""}`}>
                <label className="task-prep-checklist__label">
                  <input
                    type="checkbox"
                    className="task-prep-checklist__input"
                    checked={checked}
                    disabled={controlsDisabled}
                    onChange={(event) => onToggleItem(index, event.target.checked)}
                  />
                  <span className="task-prep-checklist__text">{label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}

      {open && editing ? (
        <ul className="task-prep-checklist__list task-prep-checklist__list--edit">
          {draftLabels.map((label, index) => (
            <li key={`edit-${index}`} className="task-prep-checklist__edit-row">
              <input
                className="field-input task-prep-checklist__edit-input"
                value={label}
                disabled={controlsDisabled}
                placeholder="Checklist item…"
                onChange={(event) =>
                  setDraftLabels((rows) => rows.map((row, itemIndex) => (itemIndex === index ? event.target.value : row)))
                }
              />
              <button
                type="button"
                className="task-prep-checklist__remove"
                disabled={controlsDisabled || draftLabels.length <= 1}
                onClick={() => void removeItem(index)}
              >
                Remove
              </button>
            </li>
          ))}
          <li className="task-prep-checklist__edit-add">
            <button type="button" className="task-prep-checklist__edit-toggle" disabled={controlsDisabled} onClick={addDraftRow}>
              Add item
            </button>
          </li>
          <li className="task-prep-checklist__edit-actions">
            <button type="button" className="task-prep-checklist__save" disabled={controlsDisabled} onClick={() => void saveEdits()}>
              Save changes
            </button>
            <button type="button" className="task-prep-checklist__cancel" disabled={controlsDisabled} onClick={cancelEditing}>
              Cancel
            </button>
          </li>
        </ul>
      ) : null}

      {open && canMutate && !editing ? (
        <div className="task-prep-checklist__manage">
          <div className="task-prep-checklist__add">
            <input
              className="field-input"
              value={newItem}
              disabled={controlsDisabled}
              placeholder="Add your own checklist item…"
              onChange={(event) => setNewItem(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addItem();
                }
              }}
            />
          </div>
          <div className="task-prep-checklist__manage-actions">
            <button type="button" className="task-prep-checklist__edit-toggle" disabled={controlsDisabled} onClick={startEditing}>
              Edit checklist
            </button>
            <button type="button" className="task-prep-checklist__delete" disabled={controlsDisabled} onClick={() => void deleteChecklist()}>
              Delete checklist
            </button>
          </div>
        </div>
      ) : null}

      {complete && !editing ? (
        <p className="task-prep-checklist__hint">
          All items checked — mark {title.toLowerCase().includes("hearing") ? "Court OK or Done" : "the task Done"} when prep is complete.
        </p>
      ) : null}
    </section>
  );
}

export function hasTaskPrepChecklist(remarks: string): boolean {
  return Boolean(parsePrepChecklistState(remarks));
}

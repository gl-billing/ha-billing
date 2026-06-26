"use client";

type PrepChecklistEditorProps = {
  label: string;
  hint?: string;
  standardOptions: readonly string[];
  selectedItems: string[];
  onToggleStandard: (item: string) => void;
  customItems: string[];
  newItem: string;
  onNewItemChange: (value: string) => void;
  onAddCustom: () => void;
  onRemoveCustom: (index: number) => void;
  hiddenInputName: string;
  disabled?: boolean;
};

export function PrepChecklistEditor({
  label,
  hint,
  standardOptions,
  selectedItems,
  onToggleStandard,
  customItems,
  newItem,
  onNewItemChange,
  onAddCustom,
  onRemoveCustom,
  hiddenInputName,
  disabled = false
}: PrepChecklistEditorProps) {
  return (
    <div className="event-checklist-editor">
      <span className="form-field__label">{label}</span>
      {hint ? <p className="event-checklist-editor__hint">{hint}</p> : null}
      {selectedItems.map((item, index) => (
        <input key={`${item}-${index}`} type="hidden" name={hiddenInputName} value={item} />
      ))}
      {standardOptions.length ? (
        <div className="hearing-prep-checklist__grid event-checklist-editor__options">
          {standardOptions.map((item) => (
            <label key={item} className="form-check hearing-prep-checklist__item">
              <input
                type="checkbox"
                checked={selectedItems.includes(item)}
                disabled={disabled}
                onChange={() => onToggleStandard(item)}
              />
              <span className="form-check__text">{item}</span>
            </label>
          ))}
        </div>
      ) : null}
      {customItems.length ? (
        <ul className="event-checklist-editor__custom">
          {customItems.map((item, index) => (
            <li key={`${item}-${index}`} className="event-checklist-editor__custom-item">
              <span>{item}</span>
              <button
                type="button"
                className="event-checklist-editor__remove"
                disabled={disabled}
                onClick={() => onRemoveCustom(index)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="event-checklist-editor__add">
        <input
          className="field-input"
          value={newItem}
          disabled={disabled}
          placeholder="Add another item…"
          onChange={(e) => onNewItemChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddCustom();
            }
          }}
        />
        <button
          type="button"
          className="event-checklist-editor__add-btn"
          disabled={disabled || !newItem.trim()}
          onClick={onAddCustom}
        >
          Add item
        </button>
      </div>
    </div>
  );
}

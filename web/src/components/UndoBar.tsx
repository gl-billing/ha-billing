"use client";

type Props = {
  title: React.ReactNode;
  hint?: string;
  actionLabel?: string;
  busy?: boolean;
  onUndo: () => void;
};

export function UndoBar({ title, hint = "You have 30 seconds to undo.", actionLabel = "Undo", busy, onUndo }: Props) {
  return (
    <div className="undo-bar card mb-4" role="status">
      <div className="undo-bar__copy">
        <p className="undo-bar__title">{title}</p>
        {hint ? <p className="undo-bar__hint">{hint}</p> : null}
      </div>
      <button type="button" className="undo-bar__btn" disabled={busy} onClick={onUndo}>
        {actionLabel}
      </button>
    </div>
  );
}

import { useEffect, useRef, type ReactNode, type Ref } from "react";

export interface SheetProps {
  /** The id of the sheet's title (a `.cw-dialog-title`), for screen readers. */
  labelledBy: string;
  /** Called once it has closed: Escape, the backdrop, or `ref.current.close()`. */
  onClose: () => void;
  /** The <dialog>, to close it from inside (`ref.current?.close()`). */
  ref?: Ref<HTMLDialogElement>;
  children: ReactNode;
}

/**
 * A native modal <dialog>, open while it's rendered: a centred card on wide
 * screens, a sheet along the bottom on a phone (the .cw-dialog styles).
 * Focus, Escape and the backdrop come free. Put a `.cw-dialog-body` inside,
 * with a `.cw-dialog-title` and `.cw-dialog-actions`.
 */
export function Sheet({ labelledBy, onClose, ref, children }: SheetProps) {
  const own = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = own.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={(node) => {
        own.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className="cw-dialog"
      aria-labelledby={labelledBy}
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}

export interface FieldProps {
  label: string;
  /** A line under the control, e.g. what it's for. */
  hint?: string;
  /** Shown in place of the hint, and read out, when the value won't do. */
  error?: string | null;
  /** The control: an `<input className="cw-input">`, a textarea or a select. */
  children: ReactNode;
}

/** A labelled form control in the house style: a 16px field, so iOS doesn't zoom into it. */
export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="cw-field">
      <span className="cw-field-label">{label}</span>
      {children}
      {error ? (
        <span className="cw-field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="cw-field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

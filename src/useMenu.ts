import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * The manners of a menu, shared by the app switcher and the account menu:
 * a tap outside or Escape closes it, focus returns to the trigger, and the
 * arrow keys walk the items.
 */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = useCallback(
    () => Array.from(anchorRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []),
    [],
  );

  // Opening with the keyboard lands focus on the first item.
  useEffect(() => {
    if (open && document.activeElement === triggerRef.current) {
      const first = items()[0];
      if (first && triggerRef.current?.dataset.cwKeyboard === "true") first.focus();
    }
  }, [open, items]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.currentTarget.dataset.cwKeyboard = "true";
      setOpen(true);
    }
  };

  const onTriggerClick = () => {
    if (triggerRef.current) triggerRef.current.dataset.cwKeyboard = "false";
    setOpen((current) => !current);
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    if (list.length === 0) return;
    const index = list.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (event.key === "ArrowDown") next = (index + 1) % list.length;
    else if (event.key === "ArrowUp") next = (index - 1 + list.length) % list.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = list.length - 1;
    else if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (next >= 0) {
      event.preventDefault();
      list[next]?.focus();
    }
  };

  const close = useCallback(() => setOpen(false), []);

  return { open, close, anchorRef, triggerRef, onTriggerClick, onTriggerKeyDown, onMenuKeyDown };
}

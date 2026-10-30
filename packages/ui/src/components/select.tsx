"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface SelectOption {
  group?: string;
  icon?: ReactNode;
  label: string;
  value: string;
}

interface SelectProps {
  "aria-label"?: string;
  className?: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value: string;
}

const GAP = 6;
const MAX_MENU_HEIGHT = 280;

/** A styled dropdown with the keyboard behavior of a native select. */
export function Select({
  "aria-label": ariaLabel,
  className = "",
  onChange,
  options,
  placeholder = "Select",
  value,
}: SelectProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.value === value);

  function show() {
    setActive(Math.max(options.indexOf(selected as SelectOption), 0));
    setOpen(true);
  }

  function choose(option?: SelectOption) {
    setOpen(false);
    trigger.current?.focus();
    if (option && option.value !== value) onChange(option.value);
  }

  // The top layer keeps the menu above dialogs and free of their overflow clipping.
  useLayoutEffect(() => {
    const list = menu.current;
    const button = trigger.current;
    if (!open || !list || !button) return;
    if (!list.matches(":popover-open")) list.showPopover();
    const rect = button.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - GAP * 2;
    const above = rect.top - GAP * 2;
    const height = Math.min(list.scrollHeight, MAX_MENU_HEIGHT);
    const flip = below < height && above > below;
    const width = Math.min(rect.width, window.innerWidth - GAP * 2);
    list.style.left = `${Math.min(rect.left, window.innerWidth - width - GAP)}px`;
    list.style.maxHeight = `${Math.min(MAX_MENU_HEIGHT, flip ? above : below)}px`;
    list.style.top = flip
      ? `${rect.top - GAP - Math.min(height, above)}px`
      : `${rect.bottom + GAP}px`;
    list.style.width = `${width}px`;
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const isInside = (target: EventTarget | null) =>
      target instanceof Node &&
      (menu.current?.contains(target) || trigger.current?.contains(target));
    const onPointerDown = (event: PointerEvent) => {
      if (!isInside(event.target)) setOpen(false);
    };
    // A fixed menu would drift away from its trigger.
    const onMove = (event: Event) => {
      if (event.target !== menu.current) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${id}-${active}`)?.scrollIntoView({
      block: "nearest",
    });
  }, [active, id, open]);

  function onKeyDown(event: KeyboardEvent) {
    const last = options.length - 1;
    if (!open) {
      if ([" ", "ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      End: last,
      Home: 0,
    };
    const next = moves[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setActive(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === "Escape") {
      // Escape closes only the menu, not the dialog around it.
      event.preventDefault();
      event.stopPropagation();
      choose();
    }
  }

  return (
    <>
      <button
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`select-trigger ${open ? "open" : ""} ${className}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        ref={trigger}
        role="combobox"
        type="button"
      >
        {selected?.icon}
        <span
          className={selected ? "select-value" : "select-value placeholder"}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      {open && (
        <ul
          className="select-menu"
          id={`${id}-menu`}
          // Inside a label, a click would otherwise reactivate the trigger.
          onClick={(event) => event.preventDefault()}
          popover="manual"
          ref={menu}
          role="listbox"
        >
          {options.length === 0 && (
            <li className="select-empty" role="presentation">
              No options available
            </li>
          )}
          {options.map((option, index) => (
            <li key={option.value} role="presentation">
              {option.group && option.group !== options[index - 1]?.group && (
                <div className="select-group">{option.group}</div>
              )}
              <div
                aria-selected={option.value === value}
                className={`select-option ${index === active ? "active" : ""}`}
                id={`${id}-${index}`}
                onClick={() => choose(option)}
                onPointerMove={() => setActive(index)}
                role="option"
              >
                {option.icon}
                <span>{option.label}</span>
                {option.value === value && (
                  <Check aria-hidden="true" size={15} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
